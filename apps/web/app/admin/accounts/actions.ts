'use server';

import { revalidatePath } from 'next/cache';
import { createAdminSupabase, getCurrentUser } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

type ActionResult = { ok: boolean; error?: string };

const ROLES = ['donor', 'organizer', 'org_member', 'admin'] as const;
type Role = (typeof ROLES)[number];

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

/** Change a profile's role. */
export async function setUserRole(
  profileId: string,
  role: string,
): Promise<ActionResult> {
  const adminId = await requireAdminId();
  if (!ROLES.includes(role as Role)) {
    return { ok: false, error: 'Invalid role' };
  }
  const supabase = createAdminSupabase();

  // Prevent locking the whole team out: don't demote the last remaining admin.
  if (role !== 'admin') {
    const { data: target } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', profileId)
      .maybeSingle();
    if (target?.role === 'admin') {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin');
      if ((count ?? 0) <= 1) {
        return { ok: false, error: 'Cannot demote the last remaining admin.' };
      }
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', profileId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: adminId,
    action: 'role.changed',
    entityType: 'profile',
    entityId: profileId,
    metadata: { role },
  });

  revalidatePath('/admin/accounts');
  return { ok: true };
}

/** Form-bound wrapper (returns void for <form action>). */
export async function setUserRoleForm(formData: FormData): Promise<void> {
  const profileId = String(formData.get('profileId') ?? '');
  const role = String(formData.get('role') ?? '');
  await setUserRole(profileId, role);
}
