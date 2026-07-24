'use server';

import { revalidatePath } from 'next/cache';
import { createAdminSupabase } from '@/lib/supabase/server';
import { refundPayment } from '@/lib/stripe';
import { sendRefundConfirmation } from '@/lib/email';
import { logAudit } from '@/lib/audit';
import { requireAdminId } from '@/lib/admin-auth';
import { fail, succeed, type ActionState } from '@/lib/action-result';
import { runAction } from '@/lib/run-action';

/**
 * Refund a succeeded donation in full. Allowed ONLY before any of the campaign's
 * funds have been released — once a transfer is out, the held balance can no
 * longer cover a refund and it must be handled via transfer reversal instead
 * (ARCHITECTURE.md §4). Flipping the donation to 'refunded' lets the
 * trg_sync_amount_raised trigger decrement the campaign's amount_raised.
 */
export async function refundDonation(
  donationId: string,
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return runAction('admin-refund', async () => {
    const adminId = await requireAdminId();
    const supabase = createAdminSupabase();

    const { data: donation, error: dErr } = await supabase
      .from('donations')
      .select(
        'id, status, amount, currency, campaign_id, stripe_payment_intent_id, donor_email, donor_name',
      )
      .eq('id', donationId)
      .single();
    if (dErr || !donation) {
      return fail('donation_not_found', undefined, dErr?.message);
    }
    if (donation.status !== 'succeeded') {
      return fail('refund_only_succeeded');
    }
    if (!donation.stripe_payment_intent_id) {
      return fail('refund_no_payment');
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
      return fail('refund_after_release');
    }

    // Issue the Stripe refund first (idempotent on the donation id so a retry can
    // never double-refund), then record it.
    try {
      await refundPayment(donation.stripe_payment_intent_id, `refund_${donation.id}`);
    } catch (err) {
      console.error('[admin-refund]', err);
      return fail(
        'refund_failed',
        undefined,
        err instanceof Error ? err.message : undefined,
      );
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
      return fail('refund_record_failed');
    }
    if (!updated || updated.length === 0) {
      // A concurrent refund already flipped it; the idempotency key means Stripe
      // did not double-refund.
      return fail('refund_already_done');
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

  // Best-effort: tell the donor their money is on the way back. A failure here
  // must not undo the refund, so log and continue.
  if (donation.donor_email) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('title')
      .eq('id', donation.campaign_id)
      .maybeSingle();
    const emailed = await sendRefundConfirmation({
      to: donation.donor_email,
      donorName: donation.donor_name ?? undefined,
      amount: `${donation.currency} ${Number(donation.amount ?? 0).toFixed(2)}`,
      campaignTitle: campaign?.title ?? 'a fundraiser',
    });
    if (!emailed.ok) {
      console.error('[refundDonation] failed to send refund email:', emailed.error);
    }
  }

  revalidatePath('/admin/donations');
  if (donation.campaign_id) {
    revalidatePath(`/admin/campaigns/${donation.campaign_id}`);
  }
  revalidatePath('/admin');
  return succeed();
  });
}
