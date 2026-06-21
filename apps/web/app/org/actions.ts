'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminSupabase, getCurrentUser } from '@/lib/supabase/server';
import { requireOrgLead, requireOrgMember } from '@/lib/org-auth';
import { createConnectAccount, createOnboardingLink } from '@/lib/stripe';
import { logAudit } from '@/lib/audit';

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}
function nullable(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v === '' ? null : v;
}

/**
 * Lead-only profile edit. Deliberately writes ONLY presentational fields —
 * never status, type, or can_be_* (those stay admin-controlled so a lead can't
 * self-verify or grant itself beneficiary/verifier powers).
 */
export async function updateOrgProfile(formData: FormData): Promise<void> {
  const orgId = str(formData, 'organization_id');
  if (!orgId) throw new Error('Missing organization id');
  const profileId = await requireOrgLead(orgId);
  const supabase = createAdminSupabase();

  const name = str(formData, 'name');
  if (!name) throw new Error('Name is required');

  const { error } = await supabase
    .from('organizations')
    .update({
      name,
      description: nullable(formData, 'description'),
      contact_email: nullable(formData, 'contact_email'),
      contact_phone: nullable(formData, 'contact_phone'),
      country: nullable(formData, 'country'),
      logo_url: nullable(formData, 'logo_url'),
    })
    .eq('id', orgId);
  if (error) throw new Error(error.message);

  await logAudit({
    actorId: profileId,
    action: 'organization.profile_updated',
    entityType: 'organization',
    entityId: orgId,
  });
  revalidatePath('/org');
}

/**
 * Begin (or resume) Stripe Connect onboarding for the org, then redirect to the
 * hosted KYC flow. Creates the connected account on first use. Any member may
 * start it; the account.updated webhook flips stripe_onboarding_complete.
 */
export async function startOrgOnboarding(formData: FormData): Promise<void> {
  const orgId = str(formData, 'organization_id');
  if (!orgId) throw new Error('Missing organization id');
  const profileId = await requireOrgMember(orgId);
  const supabase = createAdminSupabase();

  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, contact_email, stripe_connect_account_id')
    .eq('id', orgId)
    .single();
  if (error || !org) throw new Error(error?.message ?? 'Organization not found');

  let accountId = org.stripe_connect_account_id as string | null;
  if (!accountId) {
    accountId = await createConnectAccount({ email: org.contact_email ?? undefined });
    const { error: upErr } = await supabase
      .from('organizations')
      .update({ stripe_connect_account_id: accountId })
      .eq('id', orgId);
    if (upErr) throw new Error(upErr.message);
  }

  const url = await createOnboardingLink(accountId, { basePath: '/org/onboarding' });
  await logAudit({
    actorId: profileId,
    action: 'organization.onboarding_started',
    entityType: 'organization',
    entityId: orgId,
  });
  redirect(url);
}

/**
 * Chapter-lead verification. A LEAD of the organization a fundraiser is
 * designated to may approve/reject that fundraiser's verifications (death /
 * relationship) — the local trust decision (e.g. a mosque vouching for its
 * community's deaths).
 *
 * Self-dealing safeguard: this only sets the verification DECISION. Moving money
 * is unaffected — releaseFunds() stays platform-admin-only, so the same person
 * can never both vouch for a death AND release funds to their own org. The admin
 * release is the required second set of eyes.
 */
export async function reviewVerification(formData: FormData): Promise<void> {
  const verificationId = str(formData, 'verification_id');
  const status = str(formData, 'status');
  if (status !== 'approved' && status !== 'rejected') {
    throw new Error('Invalid verification status');
  }
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const supabase = createAdminSupabase();

  const { data: verification } = await supabase
    .from('verifications')
    .select('id, campaign_id, type')
    .eq('id', verificationId)
    .maybeSingle();
  if (!verification) throw new Error('Verification not found');

  // The fundraiser must be designated to an organization, and the actor must be
  // a LEAD of that organization.
  const { data: beneficiary } = await supabase
    .from('beneficiaries')
    .select('organization_id')
    .eq('campaign_id', verification.campaign_id)
    .eq('is_active', true)
    .eq('type', 'organization')
    .maybeSingle();
  if (!beneficiary?.organization_id) {
    throw new Error('This fundraiser is not designated to an organization');
  }
  await requireOrgLead(beneficiary.organization_id); // throws unless a lead

  const { error } = await supabase
    .from('verifications')
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', verificationId);
  if (error) throw new Error(error.message);

  await logAudit({
    actorId: user.id,
    action: `verification.${status}`,
    entityType: 'verification',
    entityId: verificationId,
    metadata: { campaignId: verification.campaign_id, via: 'chapter_lead' },
  });
  revalidatePath('/org');
}
