'use server';

import { redirect } from 'next/navigation';
import { createDonationCheckout, toMinorUnits } from '@/lib/stripe';

/**
 * Server action invoked from <DonateForm>. Validates the amount, creates a
 * Stripe Checkout Session, and redirects the donor to Stripe's hosted page.
 *
 * Must be used via `<form action={startDonation}>` so the thrown redirect()
 * propagates to the framework and performs the navigation.
 */
export async function startDonation(formData: FormData): Promise<void> {
  const campaignId = String(formData.get('campaignId') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim();
  const currency = String(formData.get('currency') ?? '').trim() || 'eur';
  const campaignTitle = String(formData.get('campaignTitle') ?? '').trim();

  if (!campaignId || !slug) {
    throw new Error('Missing campaign details.');
  }

  // Amount: prefer the explicit custom amount, else the selected preset.
  const customRaw = String(formData.get('customAmount') ?? '').trim();
  const presetRaw = String(formData.get('amount') ?? '').trim();
  const amount = Number.parseFloat(customRaw || presetRaw);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Please enter a donation amount greater than zero.');
  }

  const donorEmail = String(formData.get('donorEmail') ?? '').trim();
  const isAnonymous = formData.get('isAnonymous') === 'on';
  const message = String(formData.get('message') ?? '').trim();

  const session = await createDonationCheckout({
    campaignId,
    campaignSlug: slug,
    campaignTitle,
    amountMinor: toMinorUnits(amount),
    currency,
    donorEmail: donorEmail || undefined,
    isAnonymous,
    message: message || undefined,
  });

  if (!session.url) {
    throw new Error('Could not start the donation checkout. Please try again.');
  }

  redirect(session.url);
}
