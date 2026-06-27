'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminSupabase, getCurrentUser } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { sendOrgInvite } from '@/lib/email';

const ORG_TYPES = [
  'embassy',
  'funeral_home',
  'charity',
  'employer',
  'community',
  'religious',
] as const;
type OrgType = (typeof ORG_TYPES)[number];

const ORG_STATUSES = ['pending', 'verified', 'suspended'] as const;
type OrgStatus = (typeof ORG_STATUSES)[number];

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

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function nullable(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v === '' ? null : v;
}

/** Create a new organization. */
export async function createOrganization(formData: FormData): Promise<void> {
  const adminId = await requireAdminId();
  const supabase = createAdminSupabase();

  const name = str(formData, 'name');
  if (!name) throw new Error('Name is required');

  const type = str(formData, 'type');
  if (!ORG_TYPES.includes(type as OrgType)) throw new Error('Invalid type');

  const payload = {
    name,
    type,
    country: nullable(formData, 'country'),
    contact_email: nullable(formData, 'contact_email'),
    contact_phone: nullable(formData, 'contact_phone'),
    description: nullable(formData, 'description'),
    can_be_beneficiary: formData.get('can_be_beneficiary') === 'on',
    can_be_verifier: formData.get('can_be_verifier') === 'on',
    status: 'pending' as OrgStatus,
    created_by: adminId,
  };

  const { data, error } = await supabase
    .from('organizations')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  await logAudit({
    actorId: adminId,
    action: 'organization.created',
    entityType: 'organization',
    entityId: data?.id ?? null,
    metadata: { name, type },
  });

  revalidatePath('/admin/organizations');
  redirect('/admin/organizations');
}

/** Update an existing organization (id supplied via a hidden field). */
export async function updateOrganization(formData: FormData): Promise<void> {
  const adminId = await requireAdminId();
  const supabase = createAdminSupabase();

  const id = str(formData, 'id');
  if (!id) throw new Error('Missing organization id');

  const name = str(formData, 'name');
  if (!name) throw new Error('Name is required');

  const type = str(formData, 'type');
  if (!ORG_TYPES.includes(type as OrgType)) throw new Error('Invalid type');

  const status = str(formData, 'status');
  if (!ORG_STATUSES.includes(status as OrgStatus)) {
    throw new Error('Invalid status');
  }

  const payload = {
    name,
    type,
    country: nullable(formData, 'country'),
    contact_email: nullable(formData, 'contact_email'),
    contact_phone: nullable(formData, 'contact_phone'),
    description: nullable(formData, 'description'),
    status,
    can_be_beneficiary: formData.get('can_be_beneficiary') === 'on',
    can_be_verifier: formData.get('can_be_verifier') === 'on',
  };

  const { error } = await supabase
    .from('organizations')
    .update(payload)
    .eq('id', id);
  if (error) throw new Error(error.message);

  await logAudit({
    actorId: adminId,
    action: 'organization.updated',
    entityType: 'organization',
    entityId: id,
    metadata: { name, type, status },
  });

  revalidatePath('/admin/organizations');
  revalidatePath(`/admin/organizations/${id}`);
  redirect('/admin/organizations');
}

const INVITE_TTL_DAYS = 7;

/**
 * Invite someone (by email) to onboard/manage an organization. If
 * `organization_id` is provided they will join that org; if omitted, they will
 * create a brand-new org when they accept. Sends a tokenized accept link.
 */
export async function inviteOrgMember(formData: FormData): Promise<void> {
  const adminId = await requireAdminId();
  const supabase = createAdminSupabase();

  const email = str(formData, 'email').toLowerCase();
  if (!email || !email.includes('@')) throw new Error('A valid email is required');

  const organizationId = nullable(formData, 'organization_id');
  const memberRole = str(formData, 'member_role') === 'staff' ? 'staff' : 'lead';

  // If joining an existing org, confirm it exists (and grab its name for the email).
  let orgName: string | undefined;
  if (organizationId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();
    if (!org) throw new Error('Organization not found');
    orgName = org.name as string;
  }

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: invite, error } = await supabase
    .from('organization_invites')
    .insert({
      organization_id: organizationId,
      email,
      member_role: memberRole,
      token,
      status: 'pending',
      invited_by: adminId,
      expires_at: expiresAt,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const sent = await sendOrgInvite({ to: email, orgName, token });
  if (!sent.ok) {
    // Roll back the invite so it isn't left dangling with no email delivered.
    await supabase.from('organization_invites').delete().eq('id', invite.id);
    throw new Error(`Could not send invite email: ${sent.error}`);
  }

  await logAudit({
    actorId: adminId,
    action: 'organization.invited',
    entityType: 'organization',
    entityId: organizationId,
    metadata: { email, memberRole },
  });

  revalidatePath('/admin/organizations');
  if (organizationId) revalidatePath(`/admin/organizations/${organizationId}`);
}

/** Revoke a pending invite. */
export async function revokeOrgInvite(formData: FormData): Promise<void> {
  const adminId = await requireAdminId();
  const supabase = createAdminSupabase();
  const inviteId = str(formData, 'invite_id');
  if (!inviteId) throw new Error('Missing invite id');

  const { data, error } = await supabase
    .from('organization_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('status', 'pending')
    .select('organization_id')
    .maybeSingle();
  if (error) throw new Error(error.message);

  await logAudit({
    actorId: adminId,
    action: 'organization.invite_revoked',
    entityType: 'organization',
    entityId: data?.organization_id ?? null,
  });

  revalidatePath('/admin/organizations');
  if (data?.organization_id) {
    revalidatePath(`/admin/organizations/${data.organization_id}`);
  }
}
