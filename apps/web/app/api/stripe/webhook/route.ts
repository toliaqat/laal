import type Stripe from 'stripe';
import * as Sentry from '@sentry/nextjs';
import { stripe, toMajorUnits } from '@/lib/stripe';
import { createAdminSupabase } from '@/lib/supabase/server';
import { sendDonationReceipt } from '@/lib/email';
import { logAudit } from '@/lib/audit';
import { STRIPE_WEBHOOK_SECRET } from '@/lib/env';

export const runtime = 'nodejs';

/**
 * A genuine persistence failure (e.g. Supabase unavailable) while recording
 * money that Stripe has already collected. These MUST answer 5xx so Stripe
 * retries — swallowing them with a 200 silently loses the donation. Logical
 * skips (unpaid session, missing metadata) are not this.
 */
class WebhookPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookPersistenceError';
  }
}

/**
 * A write that will NEVER succeed however often it is retried: a campaign id
 * that does not exist (foreign key), a malformed uuid, a check-constraint
 * violation. Retrying is pointless, so this answers 200 — otherwise Stripe
 * retries for three days and Sentry alerts on every single retry, burying the
 * one alert that matters. It is still reported once, loudly: money was taken
 * and we genuinely cannot record it, which needs a human.
 */
class WebhookPermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookPermanentError';
  }
}

/**
 * Postgres SQLSTATE classes that no amount of retrying fixes:
 *   22xxx data exception (e.g. 22P02 invalid uuid text)
 *   23xxx integrity constraint violation (23503 FK, 23502 not-null, 23514 check)
 *   42xxx syntax error / access rule violation (missing column, RLS refusal)
 * Everything else (connection loss, timeouts, 5xx from PostgREST, no code at
 * all) is assumed transient and retried. 23505 unique_violation is excluded
 * deliberately: for us that means "already recorded", which is a success.
 */
function isPermanentDbError(code: string | undefined): boolean {
  if (!code) return false;
  if (code === '23505') return false;
  return /^(22|23|42)/.test(code);
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[stripe webhook] signature verification failed:', msg);
    return new Response(`Webhook signature verification failed: ${msg}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        // Async payment methods (SEPA, iDEAL, bank transfers) complete the
        // session while still 'unpaid' and clear later via
        // async_payment_succeeded. handleCheckoutCompleted guards on
        // payment_status === 'paid' and upserts idempotently, so routing both
        // events through it records the donation exactly once — when the money
        // actually exists.
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'checkout.session.async_payment_failed':
        // No donation row was ever recorded (we skip 'unpaid' sessions), so
        // there is nothing to reconcile — just log for visibility.
        console.warn(
          `[stripe webhook] async payment failed for session ${
            (event.data.object as Stripe.Checkout.Session).id
          }`,
        );
        break;
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      case 'transfer.created':
        await handleTransferCreated(event.data.object as Stripe.Transfer);
        break;
      case 'payout.paid':
        await handlePayoutPaid(event.data.object as Stripe.Payout);
        break;
      case 'charge.refunded':
        // Keeps us consistent when a refund is issued OUT OF BAND (Stripe
        // Dashboard, or a dispute resolved as a refund). The in-app refund
        // action already flips the donation; this is idempotent with it.
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        // Unhandled event types are acknowledged with 200 so Stripe stops
        // retrying.
        break;
    }
  } catch (err) {
    console.error(`[stripe webhook] handler error for ${event.type}:`, err);
    Sentry.captureException(err, { tags: { webhook: event.type } });
    if (err instanceof WebhookPersistenceError) {
      // Ask Stripe to retry — the money exists but we failed to record it.
      return new Response('Failed to record donation', { status: 500 });
    }
    // Permanent failures are reported (above) and then acknowledged, so the
    // three-day retry storm — and its alert storm — never starts.
    // Everything else stays best-effort: a 200 stops Stripe hammering us with
    // retries for application-level errors it cannot help with.
  }

  return new Response(null, { status: 200 });
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const campaignId = session.metadata?.campaign_id;
  if (!campaignId) {
    console.warn('[stripe webhook] checkout.session.completed missing campaign_id');
    return;
  }

  // Only record sessions whose funds are actually collected. Async payment
  // methods complete the session while still 'unpaid'; recording those as
  // 'succeeded' would inflate amount_raised (and thus releasable funds) before
  // the money exists. Those flip to paid via async_payment_succeeded later.
  if (session.payment_status !== 'paid') {
    console.warn(
      `[stripe webhook] checkout.session.completed not paid (status=${session.payment_status}); skipping`,
    );
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  if (!paymentIntentId) {
    console.warn('[stripe webhook] checkout.session.completed missing payment_intent');
    return;
  }

  const donorEmail = session.customer_details?.email ?? null;
  // The supporter's CHOSEN display name, captured in our own form and carried
  // through metadata. Never customer_details.name: that is the cardholder's
  // legal name, and donor_name is published on the public supporter wall — so
  // someone who left the field blank or typed a nickname would otherwise have
  // their card name published.
  const chosenName = session.metadata?.donor_name?.trim() || null;
  // Only a greeting fallback for the private receipt email.
  const cardholderName = session.customer_details?.name?.trim() || null;
  const donorProfileId = session.metadata?.donor_profile_id?.trim() || null;
  const amount = toMajorUnits(session.amount_total ?? 0);
  const currency = (session.currency ?? 'eur').toUpperCase();
  const isAnonymous = session.metadata?.is_anonymous === 'true';
  const message = session.metadata?.message?.trim() || null;
  const locale = session.metadata?.locale?.trim() || undefined;

  const admin = createAdminSupabase();

  // Idempotent: stripe_payment_intent_id is UNIQUE and ignoreDuplicates makes a
  // re-delivery a no-op. NOTE what this does NOT tell us: whether the receipt
  // has been sent. An insert that commits while our response is lost (the exact
  // timeout the 500-and-retry path exists for) would come back as a duplicate
  // on the retry, so gating the receipt on "did I insert?" loses it forever.
  // The receipt has its own marker instead: donations.receipt_sent_at, claimed
  // atomically below (migration 0014).
  const { data: inserted, error: upsertError } = await admin
    .from('donations')
    .upsert(
      {
        campaign_id: campaignId,
        // Carried from the session so `donations_select_own` lets a signed-in
        // supporter see their own contributions.
        donor_profile_id: donorProfileId,
        donor_name: isAnonymous ? null : chosenName,
        donor_email: donorEmail,
        amount,
        currency,
        platform_fee: 0,
        net_amount: amount,
        is_anonymous: isAnonymous,
        message,
        stripe_payment_intent_id: paymentIntentId,
        status: 'succeeded',
      },
      { onConflict: 'stripe_payment_intent_id', ignoreDuplicates: true },
    )
    .select('id');

  if (upsertError) {
    console.error('[stripe webhook] failed to upsert donation:', upsertError);
    const detail = `donation upsert failed for ${paymentIntentId}: ${upsertError.message} (${upsertError.code ?? 'no code'})`;
    // A bad campaign id, a malformed uuid or a violated constraint will fail
    // identically forever: report it and acknowledge, instead of inviting three
    // days of retries. Anything that might heal (Supabase down, timeout) asks
    // Stripe to come back.
    throw isPermanentDbError(upsertError.code)
      ? new WebhookPermanentError(detail)
      : new WebhookPersistenceError(detail);
  }

  if (!inserted || inserted.length === 0) {
    // Already recorded by an earlier delivery. Fall through anyway: that
    // delivery may have committed the row and then died before sending the
    // receipt; the receipt claim below is what decides, not this branch.
    console.info(
      `[stripe webhook] donation for ${paymentIntentId} already recorded; checking receipt`,
    );
  }

  // Nothing to send without an address, and nothing to record either — leaving
  // receipt_sent_at null keeps its meaning honest ("a receipt is owed and
  // unsent" never applies to a supporter who gave no email).
  if (!donorEmail) return;

  // Exactly-once claim on the receipt. Single-statement compare-and-set, so
  // concurrent deliveries cannot both win.
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from('donations')
    .update({ receipt_sent_at: claimedAt })
    .eq('stripe_payment_intent_id', paymentIntentId)
    .is('receipt_sent_at', null)
    .select('id');

  if (claimError) {
    const detail = `receipt claim failed for ${paymentIntentId}: ${claimError.message} (${claimError.code ?? 'no code'})`;
    console.error('[stripe webhook]', detail);
    // Unknown receipt state: ask Stripe to retry (the insert dedupes, so the
    // retry is free) rather than risk never sending it.
    throw isPermanentDbError(claimError.code)
      ? new WebhookPermanentError(detail)
      : new WebhookPersistenceError(detail);
  }

  if (!claimed || claimed.length === 0) {
    // Someone else already sent it (or is sending it now).
    return;
  }

  /** Hand the claim back so a later delivery retries the send. */
  const releaseClaim = async (): Promise<void> => {
    const { error } = await admin
      .from('donations')
      .update({ receipt_sent_at: null })
      .eq('stripe_payment_intent_id', paymentIntentId)
      .eq('receipt_sent_at', claimedAt);
    if (error) {
      console.error(
        '[stripe webhook] failed to release receipt claim:',
        error.message,
      );
    }
  };

  // Look up the campaign for the receipt (title + slug).
  const { data: campaign, error: campaignError } = await admin
    .from('campaigns')
    .select('title, slug')
    .eq('id', campaignId)
    .maybeSingle();

  if (campaignError || !campaign) {
    await releaseClaim();
    const detail = `receipt skipped for ${paymentIntentId}: campaign ${campaignId} unreadable (${campaignError?.message ?? 'not found'})`;
    console.error('[stripe webhook]', detail);
    // A missing campaign will still be missing on every retry; a read error
    // might not be.
    throw campaign === null && !campaignError
      ? new WebhookPermanentError(detail)
      : new WebhookPersistenceError(detail);
  }

  const result = await sendDonationReceipt({
    to: donorEmail,
    // Greeting only: chosen name first, cardholder name as a fallback.
    donorName: chosenName ?? cardholderName ?? undefined,
    amount,
    currency,
    locale,
    campaignTitle: campaign.title,
    campaignSlug: campaign.slug,
    paymentReference: paymentIntentId,
  });

  if (!result.ok) {
    // The donation itself is safely recorded, so this is not worth a Stripe
    // retry of the whole event — but the claim must go back, or a redelivery
    // would see "already sent" for a receipt nobody received.
    await releaseClaim();
    console.error('[stripe webhook] failed to send receipt:', result.error);
    Sentry.captureMessage(`donation receipt failed: ${result.error}`, 'warning');
  }
}

async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  const admin = createAdminSupabase();
  // Sync both directions: an account that becomes restricted later must lose
  // its onboarding-complete flag so it is no longer releasable.
  const onboardingComplete = Boolean(account.payouts_enabled);

  await Promise.all([
    admin
      .from('organizations')
      .update({ stripe_onboarding_complete: onboardingComplete })
      .eq('stripe_connect_account_id', account.id),
    admin
      .from('beneficiaries')
      .update({ stripe_onboarding_complete: onboardingComplete })
      .eq('stripe_connect_account_id', account.id),
  ]);
}

async function handleTransferCreated(transfer: Stripe.Transfer): Promise<void> {
  const admin = createAdminSupabase();
  // Best-effort: only updates rows that exist for this transfer.
  await admin
    .from('payouts')
    .update({ status: 'in_transit' })
    .eq('stripe_transfer_id', transfer.id);
}

async function handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
  const admin = createAdminSupabase();
  // Best-effort: only updates rows that exist for this payout.
  await admin
    .from('payouts')
    .update({ status: 'paid' })
    .eq('stripe_payout_id', payout.id);
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  // Only act on a FULL refund: the schema has a single 'refunded' state and
  // amount_raised is gross, so a partial refund can't be represented faithfully.
  if (!charge.refunded) {
    console.warn(
      `[stripe webhook] charge.refunded for ${charge.id} is partial; skipping`,
    );
    return;
  }

  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;
  if (!paymentIntentId) {
    console.warn('[stripe webhook] charge.refunded missing payment_intent');
    return;
  }

  const admin = createAdminSupabase();
  // Flip only a still-'succeeded' donation. If the in-app refund action already
  // marked it 'refunded', this updates zero rows (the amount_raised trigger has
  // then already decremented), which keeps the handler idempotent.
  const { data, error } = await admin
    .from('donations')
    .update({ status: 'refunded' })
    .eq('stripe_payment_intent_id', paymentIntentId)
    .eq('status', 'succeeded')
    .select('id, campaign_id');
  if (error) {
    console.error(
      '[stripe webhook] failed to mark donation refunded:',
      error.message,
    );
    return;
  }
  if (data && data.length > 0) {
    await logAudit({
      actorId: null,
      action: 'donation.refunded',
      entityType: 'donation',
      entityId: data[0]?.id ?? null,
      metadata: { campaignId: data[0]?.campaign_id ?? null, via: 'stripe_webhook' },
    });
  }
}
