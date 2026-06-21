import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createAdminSupabase } from '@/lib/supabase/server';
import { sendDonationReceipt } from '@/lib/email';
import { logAudit } from '@/lib/audit';
import { STRIPE_WEBHOOK_SECRET } from '@/lib/env';

export const runtime = 'nodejs';

const CURRENCY_SYMBOLS: Record<string, string> = {
  eur: '€',
  usd: '$',
  gbp: '£',
};

function formatAmount(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency.toLowerCase()] ?? '';
  return `${sym}${amount.toFixed(2)}`;
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
    // Handlers are best-effort. Log and still return 200 to avoid Stripe
    // hammering us with retries for application-level errors.
    console.error(`[stripe webhook] handler error for ${event.type}:`, err);
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
  const donorName = session.customer_details?.name ?? null;
  const amount = (session.amount_total ?? 0) / 100;
  const currency = (session.currency ?? 'eur').toUpperCase();
  const isAnonymous = session.metadata?.is_anonymous === 'true';
  const message = session.metadata?.message?.trim() || null;

  const admin = createAdminSupabase();

  // Idempotent: stripe_payment_intent_id is UNIQUE, so re-delivery of the same
  // event upserts the same row rather than duplicating the donation.
  const { error: upsertError } = await admin.from('donations').upsert(
    {
      campaign_id: campaignId,
      donor_profile_id: null,
      donor_name: isAnonymous ? null : donorName,
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
    { onConflict: 'stripe_payment_intent_id' },
  );

  if (upsertError) {
    console.error('[stripe webhook] failed to upsert donation:', upsertError);
    return;
  }

  // Look up the campaign for the receipt (title + slug).
  const { data: campaign } = await admin
    .from('campaigns')
    .select('title, slug')
    .eq('id', campaignId)
    .maybeSingle();

  if (donorEmail && campaign) {
    const result = await sendDonationReceipt({
      to: donorEmail,
      donorName: donorName ?? undefined,
      amount: formatAmount(amount, currency),
      campaignTitle: campaign.title,
      campaignSlug: campaign.slug,
    });
    if (!result.ok) {
      console.error('[stripe webhook] failed to send receipt:', result.error);
    }
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
