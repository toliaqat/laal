'use server';

import { revalidatePath } from 'next/cache';
import { createAdminSupabase, getCurrentUser } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

type ActionResult = { ok: boolean; error?: string };

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

/** Close a campaign (status -> 'closed'). */
export async function closeCampaign(id: string): Promise<ActionResult> {
  const adminId = await requireAdminId();
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'closed' })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: adminId,
    action: 'campaign.closed',
    entityType: 'campaign',
    entityId: id,
  });
  revalidatePath('/admin/housekeeping');
  return { ok: true };
}

/** Pause an active campaign (active -> 'paused'). */
export async function pauseCampaign(id: string): Promise<ActionResult> {
  const adminId = await requireAdminId();
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'paused' })
    .eq('id', id)
    .eq('status', 'active');
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: adminId,
    action: 'campaign.paused',
    entityType: 'campaign',
    entityId: id,
  });
  revalidatePath('/admin/housekeeping');
  return { ok: true };
}

/** Resume a paused campaign (paused -> 'active'). */
export async function resumeCampaign(id: string): Promise<ActionResult> {
  const adminId = await requireAdminId();
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('status', 'paused');
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: adminId,
    action: 'campaign.resumed',
    entityType: 'campaign',
    entityId: id,
  });
  revalidatePath('/admin/housekeeping');
  return { ok: true };
}

/**
 * Recompute amount_raised by summing succeeded donations for the campaign and
 * writing the result back. This is the one legitimate place to write
 * campaigns.amount_raised.
 */
export async function recomputeAmountRaised(
  id: string,
): Promise<ActionResult> {
  const adminId = await requireAdminId();
  const supabase = createAdminSupabase();

  const { data: donations, error: dErr } = await supabase
    .from('donations')
    .select('amount, status')
    .eq('campaign_id', id);
  if (dErr) return { ok: false, error: dErr.message };

  const total = (donations ?? [])
    .filter((d) => d.status === 'succeeded')
    .reduce((sum, d) => sum + Number(d.amount ?? 0), 0);

  const { error } = await supabase
    .from('campaigns')
    .update({ amount_raised: total })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: adminId,
    action: 'campaign.amount_recomputed',
    entityType: 'campaign',
    entityId: id,
    metadata: { amountRaised: total },
  });
  revalidatePath('/admin/housekeeping');
  revalidatePath('/admin');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Form-bound wrappers (return void to satisfy the <form action> type).
// ---------------------------------------------------------------------------

export async function closeCampaignForm(id: string): Promise<void> {
  await closeCampaign(id);
}
export async function pauseCampaignForm(id: string): Promise<void> {
  await pauseCampaign(id);
}
export async function resumeCampaignForm(id: string): Promise<void> {
  await resumeCampaign(id);
}
export async function recomputeAmountRaisedForm(id: string): Promise<void> {
  await recomputeAmountRaised(id);
}
