'use server';

import { revalidatePath } from 'next/cache';
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
