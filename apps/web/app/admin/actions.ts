'use server';

import { revalidatePath } from 'next/cache';
import {
  createAdminSupabase,
  getCurrentUser,
} from '@/lib/supabase/server';
import {
  createConnectAccount,
  createOnboardingLink,
  transferToBeneficiary,
  toMinorUnits,
} from '@/lib/stripe';
import { sendPayoutReleased } from '@/lib/email';
import { logAudit } from '@/lib/audit';
import { canReleaseFunds } from '@laal/types';
import type { VerificationStatus } from '@laal/types';

type ActionResult = { ok: boolean; error?: string; url?: string };

// ---------------------------------------------------------------------------
// Form-bound wrappers (return void so they satisfy the <form action> type).
// ---------------------------------------------------------------------------

export async function approveCampaignForm(id: string): Promise<void> {
  await approveCampaign(id);
}
export async function rejectCampaignForm(id: string): Promise<void> {
  await rejectCampaign(id);
}
export async function setVerificationForm(
  verificationId: string,
  status: VerificationStatus,
): Promise<void> {
  await setVerification(verificationId, status);
}
export async function releaseFundsForm(campaignId: string): Promise<void> {
  await releaseFunds(campaignId);
}

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

/** Approve a campaign: set status to active and stamp published_at. */
export async function approveCampaign(id: string): Promise<ActionResult> {
  const adminId = await requireAdminId();
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'active', published_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: adminId,
    action: 'campaign.approved',
    entityType: 'campaign',
    entityId: id,
  });
  revalidatePath('/admin/campaigns');
  revalidatePath(`/admin/campaigns/${id}`);
  revalidatePath('/admin');
  return { ok: true };
}

/** Reject a campaign. */
export async function rejectCampaign(id: string): Promise<ActionResult> {
  const adminId = await requireAdminId();
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'rejected' })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: adminId,
    action: 'campaign.rejected',
    entityType: 'campaign',
    entityId: id,
  });
  revalidatePath('/admin/campaigns');
  revalidatePath(`/admin/campaigns/${id}`);
  revalidatePath('/admin');
  return { ok: true };
}

/** Approve/reject a verification, recording the reviewing admin and time. */
export async function setVerification(
  verificationId: string,
  status: VerificationStatus,
): Promise<ActionResult> {
  const adminId = await requireAdminId();
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('verifications')
    .update({
      status,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', verificationId)
    .select('campaign_id')
    .single();
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: adminId,
    action: `verification.${status}`,
    entityType: 'verification',
    entityId: verificationId,
    metadata: { campaignId: data?.campaign_id ?? null },
  });
  if (data?.campaign_id) revalidatePath(`/admin/campaigns/${data.campaign_id}`);
  return { ok: true };
}

/**
 * Ensure the beneficiary (or its backing org) has a Stripe Connect account,
 * creating one if needed, then return a fresh onboarding link.
 */
export async function ensureOnboarding(
  beneficiaryId: string,
): Promise<ActionResult> {
  const adminId = await requireAdminId();
  const supabase = createAdminSupabase();

  const { data: beneficiary, error: bErr } = await supabase
    .from('beneficiaries')
    .select(
      'id, type, organization_id, campaign_id, stripe_connect_account_id, organizations(id, contact_email, stripe_connect_account_id)',
    )
    .eq('id', beneficiaryId)
    .single();
  if (bErr || !beneficiary) {
    return { ok: false, error: bErr?.message ?? 'Beneficiary not found' };
  }

  const org = Array.isArray(beneficiary.organizations)
    ? beneficiary.organizations[0]
    : beneficiary.organizations;

  // Organization beneficiaries onboard via the org's connect account.
  if (beneficiary.type === 'organization' && org) {
    let accountId = org.stripe_connect_account_id;
    if (!accountId) {
      accountId = await createConnectAccount({
        email: org.contact_email ?? undefined,
      });
      const { error } = await supabase
        .from('organizations')
        .update({ stripe_connect_account_id: accountId })
        .eq('id', org.id);
      if (error) return { ok: false, error: error.message };
    }
    const url = await createOnboardingLink(accountId);
    await logAudit({
      actorId: adminId,
      action: 'beneficiary.onboarding_link',
      entityType: 'beneficiary',
      entityId: beneficiary.id,
      metadata: { campaignId: beneficiary.campaign_id },
    });
    revalidatePath(`/admin/campaigns/${beneficiary.campaign_id}`);
    return { ok: true, url };
  }

  // Individual (or org-less) beneficiary onboards on the beneficiary record.
  let accountId = beneficiary.stripe_connect_account_id;
  if (!accountId) {
    accountId = await createConnectAccount({});
    const { error } = await supabase
      .from('beneficiaries')
      .update({ stripe_connect_account_id: accountId })
      .eq('id', beneficiary.id);
    if (error) return { ok: false, error: error.message };
  }
  const url = await createOnboardingLink(accountId);
  await logAudit({
    actorId: adminId,
    action: 'beneficiary.onboarding_link',
    entityType: 'beneficiary',
    entityId: beneficiary.id,
    metadata: { campaignId: beneficiary.campaign_id },
  });
  revalidatePath(`/admin/campaigns/${beneficiary.campaign_id}`);
  return { ok: true, url };
}

/**
 * Release held funds to the active beneficiary. Re-validates the release gate
 * server-side, computes the un-released balance, transfers via Stripe, records
 * a payout row and notifies the beneficiary. Guards against double release.
 */
export async function releaseFunds(campaignId: string): Promise<ActionResult> {
  const adminId = await requireAdminId();
  const supabase = createAdminSupabase();

  const { data: campaign, error: cErr } = await supabase
    .from('campaigns')
    .select('id, title, currency, amount_raised, status')
    .eq('id', campaignId)
    .single();
  if (cErr || !campaign) {
    return { ok: false, error: cErr?.message ?? 'Campaign not found' };
  }

  const { data: beneficiary, error: bErr } = await supabase
    .from('beneficiaries')
    .select(
      'id, type, display_name, stripe_connect_account_id, stripe_onboarding_complete, organization_id, organizations(contact_email, stripe_connect_account_id, stripe_onboarding_complete), profiles:individual_profile_id(email)',
    )
    .eq('campaign_id', campaignId)
    .eq('is_active', true)
    .single();
  if (bErr || !beneficiary) {
    return { ok: false, error: bErr?.message ?? 'No active beneficiary' };
  }

  const org = Array.isArray(beneficiary.organizations)
    ? beneficiary.organizations[0]
    : beneficiary.organizations;

  const destinationAccountId =
    beneficiary.type === 'organization'
      ? org?.stripe_connect_account_id ?? beneficiary.stripe_connect_account_id
      : beneficiary.stripe_connect_account_id;
  const onboardingComplete =
    beneficiary.type === 'organization'
      ? Boolean(org?.stripe_onboarding_complete) ||
        beneficiary.stripe_onboarding_complete
      : beneficiary.stripe_onboarding_complete;

  // Load verifications (latest of each type).
  const { data: verifications } = await supabase
    .from('verifications')
    .select('type, status, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  const death =
    verifications?.find((v) => v.type === 'death')?.status ?? null;
  const relationship =
    verifications?.find((v) => v.type === 'relationship')?.status ?? null;

  // Re-check the release gate server-side — never trust the client.
  const eligible = canReleaseFunds({
    beneficiaryType: beneficiary.type,
    beneficiaryOnboardingComplete: onboardingComplete,
    deathVerification: death as VerificationStatus | null,
    relationshipVerification: relationship as VerificationStatus | null,
  });
  if (!eligible) return { ok: false, error: 'Release gate not satisfied' };
  if (!destinationAccountId) {
    return { ok: false, error: 'Beneficiary has no Stripe account' };
  }

  // Compute the un-released balance in MAJOR units.
  const { data: existingPayouts } = await supabase
    .from('payouts')
    .select('amount, status')
    .eq('campaign_id', campaignId);

  const alreadyReleased = (existingPayouts ?? [])
    .filter((p) => p.status !== 'failed' && p.status !== 'cancelled')
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  const releasable = Number(campaign.amount_raised ?? 0) - alreadyReleased;
  if (releasable <= 0) {
    return { ok: false, error: 'Nothing left to release' };
  }
  const releasableMinor = toMinorUnits(releasable);

  // Atomic claim: only one release may proceed. Transition active -> completed
  // conditioned on the current status. A concurrent second call updates zero
  // rows and bails out before any money moves.
  const { data: claimed } = await supabase
    .from('campaigns')
    .update({ status: 'completed' })
    .eq('id', campaignId)
    .eq('status', 'active')
    .select('id');
  if (!claimed || claimed.length === 0) {
    return { ok: false, error: 'Campaign already released or not active' };
  }

  let transfer;
  try {
    // idempotencyKey is defense-in-depth: even if the claim is somehow bypassed,
    // Stripe returns the same transfer for an identical (campaign, amount) key.
    transfer = await transferToBeneficiary({
      amountMinor: releasableMinor,
      currency: campaign.currency,
      destinationAccountId,
      transferGroup: `campaign_${campaignId}`,
      idempotencyKey: `release_${campaignId}_${releasableMinor}`,
    });
  } catch (err) {
    // Transfer failed — release the claim so an admin can retry.
    await supabase
      .from('campaigns')
      .update({ status: 'active' })
      .eq('id', campaignId);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Stripe transfer failed',
    };
  }

  // Record the payout.
  const { error: payoutErr } = await supabase.from('payouts').insert({
    campaign_id: campaignId,
    beneficiary_id: beneficiary.id,
    amount: releasable,
    currency: campaign.currency,
    stripe_transfer_id: transfer.id,
    status: 'in_transit',
    released_by: adminId,
    released_at: new Date().toISOString(),
  });
  if (payoutErr) return { ok: false, error: payoutErr.message };

  await logAudit({
    actorId: adminId,
    action: 'payout.released',
    entityType: 'campaign',
    entityId: campaignId,
    metadata: { amount: releasable, currency: campaign.currency },
  });

  // Notify the beneficiary.
  const profile = Array.isArray(beneficiary.profiles)
    ? beneficiary.profiles[0]
    : beneficiary.profiles;
  const toEmail =
    beneficiary.type === 'organization'
      ? org?.contact_email
      : profile?.email;
  if (toEmail) {
    await sendPayoutReleased({
      to: toEmail,
      beneficiaryName: beneficiary.display_name,
      amount: `${campaign.currency} ${releasable.toFixed(2)}`,
      campaignTitle: campaign.title,
    });
  }

  // (Campaign was already set to 'completed' by the atomic claim above.)

  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath('/admin/campaigns');
  revalidatePath('/admin');
  return { ok: true };
}
