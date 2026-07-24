'use server';

import { revalidatePath } from 'next/cache';
import { createAdminSupabase } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { requireAdminId } from '@/lib/admin-auth';
import { fail, succeed, type ActionState } from '@/lib/action-result';
import { runAction } from '@/lib/run-action';

const ROLES = ['donor', 'organizer', 'org_member', 'admin'] as const;
type Role = (typeof ROLES)[number];

/** Change a profile's role. Reads profileId/role from the posted form. */
export async function setUserRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction('admin-role', async () => {
    const profileId = String(formData.get('profileId') ?? '');
    const role = String(formData.get('role') ?? '');
    const adminId = await requireAdminId();
    if (!ROLES.includes(role as Role)) {
      return fail('role_invalid');
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
          return fail('last_admin');
        }
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', profileId);
    if (error) return fail('save_failed', undefined, error.message);

    await logAudit({
      actorId: adminId,
      action: 'role.changed',
      entityType: 'profile',
      entityId: profileId,
      metadata: { role },
  });

  revalidatePath('/admin/accounts');
  return succeed();
  });
}
