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
 * Statuses at which a campaign is publicly visible — kept in step with the
 * campaign_updates SELECT policy in supabase/migrations/0005_rls_remaining.sql.
 */
export function isPubliclyVisible(status: CampaignStatus): boolean {
  return status === 'active' || status === 'completed' || status === 'closed';
}
