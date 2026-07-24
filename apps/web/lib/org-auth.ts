import 'server-only';

import { createAdminSupabase, getCurrentUser } from '@/lib/supabase/server';
import { ActionError } from '@/lib/action-result';

export type OrgMembership = {
  profileId: string;
  organizationId: string;
  orgRole: 'lead' | 'staff';
};

/** Memberships for the current user (empty if none / not signed in). */
export async function getMyMemberships(): Promise<OrgMembership[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from('organization_members')
    .select('organization_id, org_role')
    .eq('profile_id', user.id);
  return (data ?? []).map((m) => ({
    profileId: user.id,
    organizationId: m.organization_id as string,
    orgRole: (m.org_role as 'lead' | 'staff') ?? 'staff',
  }));
}

/** Require that the current user is a member of `orgId`; returns their profile id. */
export async function requireOrgMember(orgId: string): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new ActionError('not_authorized');
  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!data) throw new ActionError('not_authorized');
  return user.id;
}

/** Require that the current user is a LEAD of `orgId` (manage profile/onboarding). */
export async function requireOrgLead(orgId: string): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new ActionError('not_authorized');
  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('profile_id', user.id)
    .eq('org_role', 'lead')
    .maybeSingle();
  if (!data) throw new ActionError('not_authorized');
  return user.id;
}
