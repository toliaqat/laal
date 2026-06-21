'use server';

import { redirect } from 'next/navigation';
import { createDonationCheckout, toMinorUnits } from '@/lib/stripe';
import { createServerSupabase } from '@/lib/supabase/server';

// Donation bounds (major currency units). Capped at 50 for launch to limit
// risk while the platform is new. Raise this once trust/limits are in place.
const MIN_DONATION = 1;
const MAX_DONATION = 50;

/**
 * Server action invoked from <DonateForm>. Validates the amount, creates a
 * Stripe Checkout Session, and redirects the donor to Stripe's hosted page.
 *
 * Must be used via `<form action={startDonation}>` so the thrown redirect()
 * propagates to the framework and performs the navigation.
 */
export async function startDonation(formData: FormData): Promise<void> {
  const campaignId = String(formData.get('campaignId') ?? '').trim();

  if (!campaignId) {
    throw new Error('Missing campaign details.');
  }

  // Amount: prefer the explicit custom amount, else the selected preset.
  const customRaw = String(formData.get('customAmount') ?? '').trim();
  const presetRaw = String(formData.get('amount') ?? '').trim();
  const amount = Number.parseFloat(customRaw || presetRaw);

  if (!Number.isFinite(amount) || amount < MIN_DONATION || amount > MAX_DONATION) {
    throw new Error(
      `Please enter a donation amount between ${MIN_DONATION} and ${MAX_DONATION}.`,
    );
  }

  // Never trust client-supplied slug/currency/title — resolve them from the DB.
  // Also enforce that the campaign is actually accepting donations.
  const supabase = await createServerSupabase();
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('slug, title, currency, status')
    .eq('id', campaignId)
    .maybeSingle();

  if (!campaign) {
    throw new Error('Campaign not found.');
  }
  if (campaign.status !== 'active') {
    throw new Error('This campaign is not currently accepting donations.');
  }

  const donorEmail = String(formData.get('donorEmail') ?? '').trim();
  const isAnonymous = formData.get('isAnonymous') === 'on';
  const message = String(formData.get('message') ?? '').trim();

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

  if (!session.url) {
    throw new Error('Could not start the donation checkout. Please try again.');
  }

  redirect(session.url);
}
