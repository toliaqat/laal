'use server';

import { revalidatePath } from 'next/cache';
import { createAdminSupabase, getCurrentUser } from '@/lib/supabase/server';
import { refundPayment } from '@/lib/stripe';
import { logAudit } from '@/lib/audit';

type ActionResult = { ok: boolean; error?: string };

/** Resolve the current admin's profile id, or throw if not an admin. */
async function requireAdminId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const supabase = createAdminSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'admin') throw new Error('Not authorized');
  return profile.id;
}

/**
 * Refund a succeeded donation in full. Allowed ONLY before any of the campaign's
 * funds have been released — once a transfer is out, the held balance can no
 * longer cover a refund and it must be handled via transfer reversal instead
 * (ARCHITECTURE.md §4). Flipping the donation to 'refunded' lets the
 * trg_sync_amount_raised trigger decrement the campaign's amount_raised.
 */
export async function refundDonation(donationId: string): Promise<ActionResult> {
  const adminId = await requireAdminId();
  const supabase = createAdminSupabase();

  const { data: donation, error: dErr } = await supabase
    .from('donations')
    .select('id, status, amount, currency, campaign_id, stripe_payment_intent_id')
    .eq('id', donationId)
    .single();
  if (dErr || !donation) {
    return { ok: false, error: dErr?.message ?? 'Donation not found' };
  }
  if (donation.status !== 'succeeded') {
    return { ok: false, error: 'Only a succeeded donation can be refunded' };
  }
  if (!donation.stripe_payment_intent_id) {
    return { ok: false, error: 'Donation has no payment to refund' };
  }

  // Refunds are allowed only BEFORE release. If any non-failed payout exists for
  // the campaign, funds have started moving to the beneficiary.
  const { data: payouts } = await supabase
    .from('payouts')
    .select('status')
    .eq('campaign_id', donation.campaign_id);
  const released = (payouts ?? []).some(
    (p) => p.status !== 'failed' && p.status !== 'cancelled',
  );
  if (released) {
    return {
      ok: false,
      error:
        'Funds for this campaign have been released; a refund now requires reversing the Stripe transfer.',
    };
  }

  // Issue the Stripe refund first (idempotent on the donation id so a retry can
  // never double-refund), then record it.
  try {
    await refundPayment(donation.stripe_payment_intent_id, `refund_${donation.id}`);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Stripe refund failed',
    };
  }

  const { data: updated, error: uErr } = await supabase
    .from('donations')
    .update({ status: 'refunded' })
    .eq('id', donationId)
    .eq('status', 'succeeded')
    .select('id');
  if (uErr) {
    // Money was refunded but the record didn't update — surface loudly so it can
    // be reconciled rather than silently diverging.
    console.error(
      `[refundDonation] refund issued for ${donationId} but status update failed:`,
      uErr.message,
    );
    return {
      ok: false,
      error: 'Refund issued, but recording it failed — please reconcile.',
    };
  }
  if (!updated || updated.length === 0) {
    // A concurrent refund already flipped it; the idempotency key means Stripe
    // did not double-refund.
    return { ok: false, error: 'Donation was already refunded' };
  }

  await logAudit({
    actorId: adminId,
    action: 'donation.refunded',
    entityType: 'donation',
    entityId: donationId,
    metadata: {
      amount: Number(donation.amount ?? 0),
      currency: donation.currency,
      campaignId: donation.campaign_id,
    },
  });

  revalidatePath('/admin/donations');
  if (donation.campaign_id) {
    revalidatePath(`/admin/campaigns/${donation.campaign_id}`);
  }
  revalidatePath('/admin');
  return { ok: true };
}

/** Form-bound wrapper (returns void for <form action>). */
export async function refundDonationForm(donationId: string): Promise<void> {
  await refundDonation(donationId);
}
