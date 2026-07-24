'use server';

import { redirect } from 'next/navigation';
import { createDonationCheckout, toMinorUnits } from '@/lib/stripe';
import { createServerSupabase } from '@/lib/supabase/server';
import { fail, type ActionState } from '@/lib/action-result';
import { runAction } from '@/lib/run-action';

// Donation bounds (major currency units). Capped at 50 for launch to limit
// risk while the platform is new. Raise this once trust/limits are in place.
const MIN_DONATION = 1;
const MAX_DONATION = 50;

/**
 * Server action invoked from <DonateForm>. Validates the amount, creates a
 * Stripe Checkout Session, and redirects the donor to Stripe's hosted page.
 * Recoverable problems come back as ActionState for the inline form alert.
 */
export async function startDonation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction('donation', async () => {
    const campaignId = String(formData.get('campaignId') ?? '').trim();

    if (!campaignId) {
      // Hidden field — absence means tampering, not a user mistake.
      // eslint-disable-next-line no-restricted-syntax -- hidden-field invariant, not user-recoverable
      throw new Error('Missing campaign details.');
    }

    // Amount: prefer the explicit custom amount, else the selected preset.
    const customRaw = String(formData.get('customAmount') ?? '').trim();
    const presetRaw = String(formData.get('amount') ?? '').trim();
    const amount = Number.parseFloat(customRaw || presetRaw);

    if (
      !Number.isFinite(amount) ||
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
    const isAnonymous = formData.get('isAnonymous') === 'on';
    const message = String(formData.get('message') ?? '').trim();

    let url: string | null;
    try {
      const session = await createDonationCheckout({
        campaignId,
        campaignSlug: campaign.slug,
        campaignTitle: campaign.title,
        amountMinor: toMinorUnits(amount),
        currency: campaign.currency,
        donorEmail: donorEmail || undefined,
        isAnonymous,
        message: message || undefined,
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
  });
}
