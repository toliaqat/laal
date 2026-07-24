'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminSupabase, getCurrentUser } from '@/lib/supabase/server';
import { requireOrgLead } from '@/lib/org-auth';
import { createConnectAccount, createOnboardingLink } from '@/lib/stripe';
import { logAudit } from '@/lib/audit';
import { fail, succeed, type ActionState } from '@/lib/action-result';
import { runAction } from '@/lib/run-action';

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
export async function updateOrgProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction('org-profile', async () => {
    const orgId = str(formData, 'organization_id');
    if (!orgId) throw new Error('Missing organization id');
    const profileId = await requireOrgLead(orgId);
    const supabase = createAdminSupabase();

    const name = str(formData, 'name');
    if (!name) return fail('org_name_required');

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
    if (error) {
      console.error('[org-profile]', error);
      return fail('save_failed', undefined, error.message);
    }

    await logAudit({
      actorId: profileId,
      action: 'organization.profile_updated',
      entityType: 'organization',
      entityId: orgId,
  });
  revalidatePath('/org');
  return succeed();
  });
}

/**
 * Begin (or resume) Stripe Connect onboarding for the org, then redirect to the
 * hosted KYC flow. Creates the connected account on first use. Lead-only — this
 * binds the org's payout destination, so a view-only staff member must not be
 * able to start it (mirrors the lead-only guard on updateOrgProfile). The
 * account.updated webhook flips stripe_onboarding_complete.
 */
export async function startOrgOnboarding(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction('org-onboarding', async () => {
    const orgId = str(formData, 'organization_id');
    if (!orgId) throw new Error('Missing organization id');
    const profileId = await requireOrgLead(orgId);
    const supabase = createAdminSupabase();

    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, contact_email, stripe_connect_account_id')
      .eq('id', orgId)
      .single();
    if (error || !org) {
      return fail('org_not_found', undefined, error?.message);
    }

    let accountId = org.stripe_connect_account_id as string | null;
    let url: string;
    try {
      if (!accountId) {
        accountId = await createConnectAccount({ email: org.contact_email ?? undefined });
        const { error: upErr } = await supabase
          .from('organizations')
          .update({ stripe_connect_account_id: accountId })
          .eq('id', orgId);
        if (upErr) {
          console.error('[org-onboarding]', upErr);
          return fail('save_failed', undefined, upErr.message);
        }
      }
      url = await createOnboardingLink(accountId, { basePath: '/org/onboarding' });
    } catch (err) {
      console.error('[org-onboarding]', err);
      return fail('onboarding_link_failed');
    }

    await logAudit({
      actorId: profileId,
      action: 'organization.onboarding_started',
      entityType: 'organization',
      entityId: orgId,
  });
  redirect(url);
  });
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
export async function reviewVerification(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction('org-verification', async () => {
    const verificationId = str(formData, 'verification_id');
    const status = str(formData, 'status');
    if (status !== 'approved' && status !== 'rejected') {
      return fail('verification_status_invalid');
    }
    const user = await getCurrentUser();
    if (!user) return fail('not_authorized');
    const supabase = createAdminSupabase();

    const { data: verification } = await supabase
      .from('verifications')
      .select('id, campaign_id, type, status')
      .eq('id', verificationId)
      .maybeSingle();
    if (!verification) return fail('verification_not_found');

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
      return fail('org_not_designated');
    }
    await requireOrgLead(beneficiary.organization_id); // throws unless a lead

    // A verification is decided once. Refuse to flip an already approved/rejected
    // decision: these feed the fund-release gate, so retroactively changing one
    // (e.g. after release) would corrupt the trust record.
    if (verification.status !== 'pending' && verification.status !== 'submitted') {
      return fail('verification_already_reviewed');
    }

    // Scope the write to reviewable states and confirm a row changed — this also
    // closes the read-then-write race if two reviews land at once.
    const { data: updated, error } = await supabase
      .from('verifications')
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', verificationId)
      .in('status', ['pending', 'submitted'])
      .select('id');
    if (error) {
      console.error('[org-verification]', error);
      return fail('save_failed', undefined, error.message);
    }
    if (!updated || updated.length === 0) {
      return fail('verification_already_reviewed');
    }

    await logAudit({
      actorId: user.id,
      action: `verification.${status}`,
      entityType: 'verification',
      entityId: verificationId,
      metadata: { campaignId: verification.campaign_id, via: 'chapter_lead' },
  });
  revalidatePath('/org');
  return succeed();
  });
}
