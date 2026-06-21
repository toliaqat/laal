'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminSupabase } from '@/lib/supabase/server';
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
