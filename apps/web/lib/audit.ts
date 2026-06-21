import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';

/**
 * Append an entry to the immutable audit_log. Best-effort: never throws, so an
 * audit failure can't break the action it records. Use the service-role client
 * (audit_log has no client-accessible RLS policies).
 */
export async function logAudit(params: {
  actorId: string | null;
  action: string; // e.g. 'campaign.approved', 'payout.released', 'role.changed'
  entityType: string; // e.g. 'campaign', 'organization', 'profile'
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminSupabase();
    await admin.from('audit_log').insert({
      actor_id: params.actorId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.error('[audit] failed to write entry:', params.action, err);
  }
}
