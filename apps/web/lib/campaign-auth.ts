import 'server-only';

import { redirect } from 'next/navigation';
import type { CampaignStatus } from '@laal/types';
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server';

/** The subset of a campaign an organizer-only surface needs. */
export type OwnedCampaign = {
  id: string;
  slug: string;
  title: string;
  status: CampaignStatus;
  organizer_id: string;
};

/**
 * Guard for organizer-only campaign surfaces (dashboard sub-routes and the
 * server actions behind them): signed out → /login, not the organizer → the
 * dashboard. Mirrors the inline check in the documents route, hoisted so a page
 * and its actions can't drift apart.
 *
 * Redirects rather than returning a failure: this is not a user-recoverable
 * state, and `runAction` rethrows Next control flow untouched.
 */
export async function requireOwnedCampaign(campaignId: string): Promise<{
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  userId: string;
  campaign: OwnedCampaign;
}> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('campaigns')
    .select('id, slug, title, status, organizer_id')
    .eq('id', campaignId)
    .maybeSingle();

  if (!data || data.organizer_id !== user.id) redirect('/dashboard');

  return { supabase, userId: user.id, campaign: data as OwnedCampaign };
}

/**
 * The statuses at which a campaign is publicly visible. **This is the single
 * source of truth for the TypeScript side** — three copies of this list had
 * already drifted apart once, so import the constant rather than re-typing the
 * strings.
 *
 * It must stay identical to, in SQL:
 *   * `campaigns_select_public` and `campaign_updates_select`
 *     (supabase/migrations/0013_public_trust_projection.sql), and
 *   * the row filter of `public.campaign_trust_public` in the same file.
 *
 * `paused` is deliberately NOT here. Pausing is the platform's only takedown
 * lever — an admin pauses a fundraiser when they suspect fraud — so a paused
 * page must stop being publicly readable, or we would go on publishing
 * "Fundraiser reviewed" / "Need verified" badges and naming the beneficiary on
 * content we ourselves flagged. Closing the donate path is not enough; the
 * endorsement is the harm. The fundraiser page keeps its calm "support is
 * paused" card for the organizer and admins, who can still reach the page
 * through their own branches of the RLS policies. If a benign hold ever needs a
 * shareable link, that wants its own status (or a reason carried on the pause),
 * not `paused` back in this list — see the long note in 0013.
 */
export const PUBLIC_CAMPAIGN_STATUSES = [
  'active',
  'completed',
  'closed',
] as const satisfies readonly CampaignStatus[];

/** Is this campaign readable by anyone with the link? */
export function isPubliclyVisible(status: CampaignStatus): boolean {
  return (PUBLIC_CAMPAIGN_STATUSES as readonly CampaignStatus[]).includes(
    status,
  );
}
