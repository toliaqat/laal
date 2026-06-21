'use server';

import { redirect } from 'next/navigation';
import { createAdminSupabase, getCurrentUser } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

const ORG_TYPES = [
  'embassy',
  'funeral_home',
  'charity',
  'employer',
  'community',
  'religious',
] as const;
type OrgType = (typeof ORG_TYPES)[number];

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

/**
 * Accept an org invitation. Requires the user to be signed in (the page sends
 * them through login first). Two shapes:
 *   - invite has organization_id  -> join/manage that existing org
 *   - invite has none             -> create a new org from the submitted fields
 * Either way the user becomes an organization_member with the invite's role.
 */
export async function acceptOrgInvite(formData: FormData): Promise<void> {
  const token = str(formData, 'token');
  if (!token) throw new Error('Missing invite token');

  const user = await getCurrentUser();
  if (!user) {
    // Bounce through login, returning to the accept page with the token.
    redirect(`/login?next=${encodeURIComponent(`/org/accept?token=${token}`)}`);
  }

  const supabase = createAdminSupabase();

  const { data: invite } = await supabase
    .from('organization_invites')
    .select('id, organization_id, email, member_role, status, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (!invite) throw new Error('Invitation not found');

  // Bind acceptance to the invited address. The token is delivered by email and
  // is the only secret guarding the invite, so without this check anyone who
  // obtains the link could accept it while signed in as a different account —
  // gaining org membership (and, as a lead, the ability to start Stripe
  // onboarding for that org). Require the logged-in email to match the invite.
  const inviteEmail = String(invite.email ?? '').trim().toLowerCase();
  const userEmail = String(user!.email ?? '').trim().toLowerCase();
  if (!userEmail || userEmail !== inviteEmail) {
    throw new Error(
      'This invitation was sent to a different email address. Please sign in with that address to accept it.',
    );
  }

  if (invite.status !== 'pending') {
    throw new Error('This invitation has already been used or revoked');
  }
  if (new Date(invite.expires_at as string).getTime() < Date.now()) {
    await supabase
      .from('organization_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    throw new Error('This invitation has expired');
  }

  const memberRole = invite.member_role === 'staff' ? 'staff' : 'lead';
  let organizationId = invite.organization_id as string | null;

  // No org yet -> create one from the form (lands 'pending' for admin review).
  if (!organizationId) {
    const name = str(formData, 'name');
    if (!name) throw new Error('Organization name is required');
    const type = str(formData, 'type');
    if (!ORG_TYPES.includes(type as OrgType)) throw new Error('Choose an organization type');

    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({
        name,
        type,
        country: str(formData, 'country') || null,
        description: str(formData, 'description') || null,
        contact_email: invite.email,
        status: 'pending',
        created_by: user!.id,
      })
      .select('id')
      .single();
    if (orgErr || !org) throw new Error(orgErr?.message ?? 'Could not create organization');
    organizationId = org.id as string;
  }

  // Link membership (idempotent on the unique (organization_id, profile_id)).
  const { error: memberErr } = await supabase
    .from('organization_members')
    .upsert(
      { organization_id: organizationId, profile_id: user!.id, org_role: memberRole },
      { onConflict: 'organization_id,profile_id' },
    );
  if (memberErr) throw new Error(memberErr.message);

  // Promote a plain donor to org_member for clarity; never downgrade a higher role.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .maybeSingle();
  if (profile?.role === 'donor') {
    await supabase.from('profiles').update({ role: 'org_member' }).eq('id', user!.id);
  }

  await supabase
    .from('organization_invites')
    .update({ status: 'accepted', accepted_by: user!.id, organization_id: organizationId })
    .eq('id', invite.id);

  await logAudit({
    actorId: user!.id,
    action: 'organization.invite_accepted',
    entityType: 'organization',
    entityId: organizationId,
  });

  redirect('/org');
}
