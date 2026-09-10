'use server';

import { createAdminSupabase } from '@/lib/supabase/server';

/**
 * Public "words of support" wall. Donations are private under RLS (they hold
 * donor_email), so we read them with the service-role client and expose ONLY
 * the safe, public-facing columns — never the email. Results are limited to
 * succeeded donations that left a message, on a publicly visible campaign.
 */

const SUPPORTERS_PAGE_SIZE = 20;

// A campaign's supporters are only public once the campaign itself is public.
// Keep in sync with campaigns_select_public (0013_public_trust_projection.sql)
// and the row filter of public.campaign_trust_public. 'paused' belongs here:
// pausing is a temporary hold, the page stays shareable and readable, and
// omitting it used to blank the whole supporter wall of a paused fundraiser.
const PUBLIC_STATUSES = ['active', 'paused', 'completed', 'closed'];

export type SupporterMessage = {
  id: string;
  /** Display name, or null when the donor chose to stay anonymous. */
  name: string | null;
  message: string;
  amount: number;
  currency: string;
  createdAt: string;
};

async function isPublicCampaign(
  admin: ReturnType<typeof createAdminSupabase>,
  campaignId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('campaigns')
    .select('status')
    .eq('id', campaignId)
    .maybeSingle();
  return !!data && PUBLIC_STATUSES.includes(data.status);
}

/** Total number of supporter messages for the heading/count. */
export async function countSupporterMessages(
  campaignId: string,
): Promise<number> {
  const admin = createAdminSupabase();
  if (!(await isPublicCampaign(admin, campaignId))) return 0;

  const { count } = await admin
    .from('donations')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'succeeded')
    .not('message', 'is', null);
  return count ?? 0;
}

/**
 * Load one page of supporter messages, newest first. Returns the items plus
 * whether more remain (detected by over-fetching one row).
 */
export async function loadSupporterMessages(
  campaignId: string,
  offset: number,
): Promise<{ items: SupporterMessage[]; hasMore: boolean }> {
  const admin = createAdminSupabase();
  if (!(await isPublicCampaign(admin, campaignId))) {
    return { items: [], hasMore: false };
  }

  const from = Math.max(0, Math.floor(offset));
  const { data } = await admin
    .from('donations')
    .select('id, donor_name, is_anonymous, message, amount, currency, created_at')
    .eq('campaign_id', campaignId)
    .eq('status', 'succeeded')
    .not('message', 'is', null)
    .order('created_at', { ascending: false })
    // Over-fetch one row to know whether a "load more" should appear.
    .range(from, from + SUPPORTERS_PAGE_SIZE);

  const rows = data ?? [];
  const hasMore = rows.length > SUPPORTERS_PAGE_SIZE;
  const items: SupporterMessage[] = rows
    .slice(0, SUPPORTERS_PAGE_SIZE)
    .map((r) => ({
      id: r.id as string,
      // Defensive: never reveal a name when the donation is anonymous.
      name: r.is_anonymous ? null : ((r.donor_name as string | null) ?? null),
      message: (r.message as string) ?? '',
      amount: Number(r.amount ?? 0),
      currency: (r.currency as string) || 'EUR',
      createdAt: r.created_at as string,
    }));

  return { items, hasMore };
}
