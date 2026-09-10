'use server';

import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createDonationCheckout, toMinorUnits } from '@/lib/stripe';
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server';
import { echoFields, fail, type ActionState } from '@/lib/action-result';
import { runAction } from '@/lib/run-action';

// Donation bounds (major currency units). Capped at 50 for launch to limit
// risk while the platform is new. Raise this once trust/limits are in place.
const MIN_DONATION = 1;
const MAX_DONATION = 50;

/** Loose shape check only — Stripe/the mail provider are the real validators. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/**
 * Server action invoked from <DonateForm>. Validates the amount, creates a
 * Stripe Checkout Session, and redirects the donor to Stripe's hosted page.
 * Recoverable problems come back as ActionState for the inline form alert.
 */
export async function startDonation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(
    'donation',
    async () => {
    const campaignId = String(formData.get('campaignId') ?? '').trim();

    if (!campaignId) {
      // Hidden field — absence means tampering, not a user mistake.
      // eslint-disable-next-line no-restricted-syntax -- hidden-field invariant, not user-recoverable
      throw new Error('Missing campaign details.');
    }

    // Amount: prefer the explicit custom amount, else the selected preset.
    // Whole units only for launch — the form also enforces this, and accepting
    // 10.999 here would silently charge 11.00.
    const customRaw = String(formData.get('customAmount') ?? '').trim();
    const presetRaw = String(formData.get('amount') ?? '').trim();
    const amount = Number.parseFloat(customRaw || presetRaw);

    if (
      !Number.isFinite(amount) ||
      !Number.isInteger(amount) ||
      amount < MIN_DONATION ||
      amount > MAX_DONATION
    ) {
      return fail('donation_amount_invalid', {
        min: MIN_DONATION,
        max: MAX_DONATION,
      });
    }

    // Never trust client-supplied slug/currency/title — resolve them from the
    // DB. Also enforce that the campaign is actually accepting donations.
    const supabase = await createServerSupabase();
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('slug, title, currency, status')
      .eq('id', campaignId)
      .maybeSingle();

    if (!campaign) {
      return fail('campaign_not_found');
    }
    if (campaign.status !== 'active') {
      return fail('campaign_not_accepting');
    }

    const donorEmail = String(formData.get('donorEmail') ?? '').trim();
    if (donorEmail && !looksLikeEmail(donorEmail)) {
      return fail('email_invalid');
    }

    const isAnonymous = formData.get('isAnonymous') === 'on';
    // The name the supporter CHOSE to publish. Ignored when anonymous, and
    // never replaced by the cardholder's legal name (see the webhook).
    const donorName = isAnonymous
      ? ''
      : String(formData.get('donorName') ?? '').trim();
    const message = String(formData.get('message') ?? '').trim();
    // Set when the form was opened from the mobile app's browser handoff.
    const fromApp = String(formData.get('from') ?? '') === 'app';

    // Carry the signed-in supporter's id so `donations_select_own` lets them
    // see their own contributions later. Guests stay null.
    const user = await getCurrentUser();

    // The Checkout Session must be locale-prefixed on return (localePrefix is
    // 'always'), so thread the active locale through to Stripe.
    const locale = await getLocale();

    let url: string | null;
    try {
      const session = await createDonationCheckout({
        campaignId,
        campaignSlug: campaign.slug,
        campaignTitle: campaign.title,
        amountMinor: toMinorUnits(amount),
        currency: campaign.currency,
        locale,
        donorEmail: donorEmail || undefined,
        donorName: donorName || undefined,
        donorProfileId: user?.id,
        isAnonymous,
        message: message || undefined,
        fromApp,
        idempotencyKey: checkoutIdempotencyKey({
          campaignId,
          amount,
          donorEmail,
          donorName,
          message,
          userId: user?.id ?? '',
          fromApp,
        }),
      });
      url = session.url;
    } catch (err) {
      console.error('[donation]', err);
      return fail('checkout_failed');
    }

    if (!url) {
      return fail('checkout_failed');
    }

    redirect(url);
    },
    // isAnonymous is echoed too, so the checkbox survives a failed submit.
    echoFields(formData, ['donorName', 'donorEmail', 'message', 'isAnonymous']),
  );
}

/**
 * Stable key for an identical submit within the same 10-minute window, so an
 * impatient double-click reuses one Checkout Session instead of creating two.
 * Deliberately time-bucketed: a supporter who genuinely wants to give the same
 * amount twice can, a few minutes later. The 10-minute window must match the
 * expiry quantization in lib/stripe.ts, or a reused key would carry different
 * parameters and Stripe would reject it.
 */
function checkoutIdempotencyKey(parts: {
  campaignId: string;
  amount: number;
  donorEmail: string;
  donorName: string;
  message: string;
  userId: string;
  fromApp: boolean;
}): string {
  const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
  return createHash('sha256')
    .update(
      [
        parts.campaignId,
        parts.amount,
        parts.donorEmail,
        parts.donorName,
        parts.message,
        parts.userId,
        String(parts.fromApp),
        bucket,
      ].join('|'),
    )
    .digest('hex');
}
