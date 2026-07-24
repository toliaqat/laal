import 'server-only';

import { createAdminSupabase, getCurrentUser } from '@/lib/supabase/server';
import { ActionError } from '@/lib/action-result';

/**
 * Resolve the current admin's profile id, or throw (as a typed, recoverable
 * ActionError) if the caller is not an admin. Single source of truth for the
 * admin gate used by every admin server action.
 */
export async function requireAdminId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new ActionError('not_authorized');
  const supabase = createAdminSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'admin') {
    throw new ActionError('not_authorized');
  }
  return profile.id;
}
