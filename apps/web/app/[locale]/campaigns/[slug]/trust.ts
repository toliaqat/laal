import type { CampaignTrust } from '@laal/types';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Load the public trust facts for one fundraiser.
 *
 * `beneficiaries`, `verifications` and `profiles` are all organizer-or-admin
 * under RLS (0002_rls.sql), so querying them with the ordinary cookie/anon
 * client — as this page used to do for the beneficiary — returns null for every
 * real supporter arriving from a shared link. The
 * `campaign_trust_public` view (0013_public_trust_projection.sql) is the
 * definer-rights projection built for exactly this: a fixed allow-list of
 * non-identifying trust facts, restricted to publicly-visible campaigns and
 * granted to `anon`.
 *
 * So the ordinary client is deliberately right here: the view's own status
 * filter is the visibility rule, rather than a second check we could get wrong
 * (same reasoning as `updates.ts`). No service-role client is needed, which
 * also means a bug here cannot widen what is readable.
 */
export async function loadCampaignTrust(
  campaignId: string,
): Promise<CampaignTrust | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('campaign_trust_public')
    // Explicit columns, mirroring the view's allow-list: if someone widens the
    // view later, this page still reads only what it was reviewed to read.
    .select(
      'campaign_id, slug, reviewed, beneficiary_type, beneficiary_display_name, ' +
        'beneficiary_relationship, organization_name, organization_type, ' +
        'death_verified, relationship_verified, death_verifier_type, ' +
        'organizer_first_name, organizer_relationship',
    )
    .eq('campaign_id', campaignId)
    .maybeSingle();
  return (data as CampaignTrust | null) ?? null;
}
