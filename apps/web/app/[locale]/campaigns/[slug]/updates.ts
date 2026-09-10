import { createServerSupabase } from '@/lib/supabase/server';
import type { CampaignUpdateItem } from '@/components/campaign-updates';

/**
 * Public organizer updates for a fundraiser page.
 *
 * Unlike the supporter wall (which needs the service-role client because
 * donations hold donor emails), campaign_updates is readable by anon for
 * campaigns in ('active','completed','closed') — see
 * supabase/migrations/0005_rls_remaining.sql. So the ordinary cookie/anon
 * client is enough, and RLS is the visibility rule rather than a second check
 * we could get wrong here.
 */

const UPDATES_PAGE_SIZE = 10;

export async function loadCampaignUpdates(campaignId: string): Promise<{
  items: CampaignUpdateItem[];
  hasMore: boolean;
}> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('campaign_updates')
    .select('id, body, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    // Over-fetch one row to know whether the "most recent" footer is needed.
    .limit(UPDATES_PAGE_SIZE + 1);

  const rows = data ?? [];
  return {
    items: rows.slice(0, UPDATES_PAGE_SIZE).map((r) => ({
      id: r.id as string,
      body: (r.body as string) ?? '',
      createdAt: r.created_at as string,
    })),
    hasMore: rows.length > UPDATES_PAGE_SIZE,
  };
}
