import type { CampaignTrust } from '@laal/types';
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server';

/**
 * The columns the public projection is allowed to hand us, mirroring the
 * allow-list of `public.campaign_trust_public`
 * (supabase/migrations/0013_public_trust_projection.sql): if someone widens the
 * view later, this page still reads only what it was reviewed to read.
 *
 * `beneficiary_relationship` is intentionally absent — 0013 no longer projects
 * it. It was unbounded free text and fully redundant with
 * `organizer_relationship`, which is the same column gated on "the individual
 * beneficiary IS the organizer" (the app's only writer of it) and is what the
 * "Started by Ahmed, brother" line renders.
 */
const TRUST_COLUMNS =
  'campaign_id, slug, reviewed, beneficiary_type, beneficiary_display_name, ' +
  'organization_name, organization_type, death_verified, relationship_verified, ' +
  'death_verifier_type, organizer_first_name, organizer_relationship';

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
    .select(TRUST_COLUMNS)
    .eq('campaign_id', campaignId)
    .maybeSingle();
  return (data as CampaignTrust | null) ?? null;
}

/**
 * The organizer's (or an admin's) own view of the same facts, read straight
 * from the base tables with the caller's cookie client.
 *
 * Why this exists: the projection has no owner branch — its row filter is
 * `status in ('active','completed','closed')` — so an organizer previewing a
 * draft, a pending_review fundraiser, or one an admin has paused would see the
 * "support reaches X" line and the badges silently vanish. That line used to
 * render for them, because the page read `beneficiaries` directly and RLS
 * allowed the owner.
 *
 * This widens nothing: every read below goes through RLS with the caller's own
 * rights (`beneficiaries_select`, `verifications_select` and
 * `profiles_select_self_or_admin` are all organizer-or-admin), so for a
 * signed-in stranger it returns nothing at all. It is only ever consulted when
 * the public projection has no row to give.
 */
async function loadOwnerTrust(
  campaignId: string,
): Promise<CampaignTrust | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createServerSupabase();
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, slug, organizer_id, published_at')
    .eq('id', campaignId)
    .maybeSingle();
  if (!campaign) return null;

  const [{ data: beneficiary }, { data: verifications }, { data: profile }] =
    await Promise.all([
      supabase
        .from('beneficiaries')
        .select(
          'type, display_name, relationship_to_deceased, organization_id, individual_profile_id',
        )
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('verifications')
        .select('type, status')
        .eq('campaign_id', campaignId)
        .eq('status', 'approved'),
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', campaign.organizer_id)
        .maybeSingle(),
    ]);

  // Nothing readable for this caller: say nothing rather than render a
  // half-empty trust block.
  if (!beneficiary) return null;

  // Only a *verified* partner org may be named, exactly as the view's join
  // condition (and organizations_select_public) require.
  let organizationName: string | null = null;
  let organizationType: CampaignTrust['organization_type'] = null;
  if (beneficiary.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name, type, status')
      .eq('id', beneficiary.organization_id)
      .maybeSingle();
    if (org?.status === 'verified') {
      organizationName = (org.name as string | null) ?? null;
      organizationType = (org.type ??
        null) as CampaignTrust['organization_type'];
    }
  }

  const approved = (verifications ?? []) as { type: string }[];
  const firstName =
    ((profile?.full_name as string | null) ?? '').trim().split(/\s+/)[0] || null;

  return {
    campaign_id: campaign.id as string,
    slug: campaign.slug as string,
    reviewed: campaign.published_at != null,
    beneficiary_type: (beneficiary.type ??
      null) as CampaignTrust['beneficiary_type'],
    // Individuals only, matching the view: for an organization this column is a
    // stale copy of organizations.name, and naming the org is the verified-org
    // read below or nothing.
    beneficiary_display_name:
      beneficiary.type === 'individual'
        ? ((beneficiary.display_name as string | null) ?? null)
        : null,
    // Not projected publicly, so it stays null here too: the organizer's preview
    // should show the page a supporter will see, not a line only they get.
    organization_name: organizationName,
    organization_type: organizationType,
    death_verified: approved.some((v) => v.type === 'death'),
    relationship_verified: approved.some((v) => v.type === 'relationship'),
    // Deliberately absent from the preview: the verifier-org rollup is derived
    // inside the definer view, and naming an institution is a public-page claim
    // rather than something the organizer needs while editing.
    death_verifier_type: null,
    organizer_first_name: firstName,
    organizer_relationship:
      beneficiary.individual_profile_id === campaign.organizer_id
        ? ((beneficiary.relationship_to_deceased as string | null) ?? null)
        : null,
  };
}

/**
 * What the current viewer may be told about this fundraiser: the public
 * projection first and, only when it has nothing (a draft, a pending review, a
 * paused/taken-down page), the owner-scoped read above.
 */
export async function loadCampaignTrustForViewer(
  campaignId: string,
): Promise<CampaignTrust | null> {
  return (await loadCampaignTrust(campaignId)) ?? loadOwnerTrust(campaignId);
}
