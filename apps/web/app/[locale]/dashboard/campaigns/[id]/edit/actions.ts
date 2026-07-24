'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server';
import {
  assertValidCoverFile,
  deleteCoverImage,
  hasCoverFile,
  uploadCoverImage,
} from '@/lib/cover-image';
import { normalizeCurrency } from '@/lib/stripe';
import { echoFields, fail, type ActionState } from '@/lib/action-result';
import { runAction } from '@/lib/run-action';
import type { IntendedUse } from '@laal/types';

const INTENDED_USES: IntendedUse[] = ['local_burial', 'repatriation'];

const EDITABLE_STATUSES = ['draft', 'pending_review'] as const;

/**
 * Update a campaign and its active beneficiary. Ownership and editable status
 * are re-checked server-side; the client is never trusted. Redirects to
 * /dashboard on success; recoverable problems come back as ActionState.
 */
// Echoed back on failure so the form restores the organizer's edits.
const ECHO_FIELDS = [
  'title',
  'story',
  'goal_amount',
  'death_country',
  'death_city',
  'repatriation_city',
  'display_name',
  'relationship_to_deceased',
] as const;

export async function updateCampaign(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(
    'update-campaign',
    async () => {
    const user = await getCurrentUser();
    if (!user) {
      redirect('/login');
    }

    const campaignId = String(formData.get('campaign_id') ?? '').trim();
    if (!campaignId) {
      redirect('/dashboard');
    }

    const supabase = await createServerSupabase();

    // ---- Server-side authorization ----
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, organizer_id, status, cover_image_url')
      .eq('id', campaignId)
      .maybeSingle();

    if (
      !campaign ||
      campaign.organizer_id !== user!.id ||
      !EDITABLE_STATUSES.includes(
        campaign.status as (typeof EDITABLE_STATUSES)[number],
      )
    ) {
      redirect('/dashboard');
    }

    // ---- Parse fields ----
    const title = String(formData.get('title') ?? '').trim();
    const story = String(formData.get('story') ?? '').trim();
    const currency = normalizeCurrency(formData.get('currency'));
    const deathCountry = String(formData.get('death_country') ?? '').trim();
    const deathCity = String(formData.get('death_city') ?? '').trim();
    const repatriationCity = String(
      formData.get('repatriation_city') ?? '',
    ).trim();

    const intendedUseRaw = String(formData.get('intended_use') ?? '');
    const intendedUse = INTENDED_USES.includes(intendedUseRaw as IntendedUse)
      ? (intendedUseRaw as IntendedUse)
      : 'local_burial';

    const goalAmount = Number(formData.get('goal_amount'));

    const beneficiaryKind = String(formData.get('beneficiary_kind') ?? '');

    // Optional cover image change: a new file replaces the current one; the
    // checkbox removes it. Validate the file up front before any writes.
    const coverField = formData.get('cover_image');
    const coverFile = hasCoverFile(coverField)
      ? assertValidCoverFile(coverField)
      : null;
    const removeCover = String(formData.get('remove_cover') ?? '') === '1';

    // ---- Validation ----
    if (!title) return fail('title_required');
    if (!Number.isFinite(goalAmount) || goalAmount <= 0) {
      return fail('goal_amount_invalid');
    }

    let organizationId: string | null = null;
    let displayName = '';
    let relationship: string | null = null;

    if (beneficiaryKind === 'organization') {
      organizationId = String(formData.get('organization_id') ?? '').trim();
      if (!organizationId) {
        return fail('beneficiary_org_required');
      }
    } else if (beneficiaryKind === 'individual') {
      displayName = String(formData.get('display_name') ?? '').trim();
      relationship =
        String(formData.get('relationship_to_deceased') ?? '').trim() || null;
      if (!displayName) {
        return fail('beneficiary_name_required');
      }
    } else {
      return fail('beneficiary_kind_required');
    }

    // ---- Validate org beneficiary BEFORE writing anything ----
    let beneficiaryName = displayName;
    if (beneficiaryKind === 'organization') {
      const { data: org } = await supabase
        .from('organizations')
        .select('name, status, can_be_beneficiary')
        .eq('id', organizationId)
        .maybeSingle();
      if (!org || org.status !== 'verified' || !org.can_be_beneficiary) {
        return fail('org_not_selectable');
      }
      beneficiaryName = org.name;
    }

    // ---- Update the campaign (never write amount_raised) ----
    const { error: campaignError } = await supabase
      .from('campaigns')
      .update({
        title,
        story: story || null,
        goal_amount: goalAmount,
        currency,
        intended_use: intendedUse,
        death_country: deathCountry || null,
        death_city: deathCity || null,
        repatriation_city:
          intendedUse === 'repatriation' ? repatriationCity || null : null,
      })
      .eq('id', campaignId);

    if (campaignError) {
      console.error('[update-campaign]', campaignError);
      return fail('save_failed', undefined, campaignError.message);
    }

    // ---- Cover image: replace, remove, or leave as-is ----
    const oldCover = campaign.cover_image_url as string | null;
    if (coverFile) {
      try {
        const url = await uploadCoverImage(campaignId, coverFile);
        await supabase
          .from('campaigns')
          .update({ cover_image_url: url })
          .eq('id', campaignId);
        await deleteCoverImage(oldCover); // drop the replaced object
      } catch {
        // Leave the existing image in place if the upload fails.
      }
    } else if (removeCover && oldCover) {
      await supabase
        .from('campaigns')
        .update({ cover_image_url: null })
        .eq('id', campaignId);
      await deleteCoverImage(oldCover);
    }

    // ---- Update the active beneficiary to match the chosen type ----
    const beneficiaryUpdate =
      beneficiaryKind === 'organization'
        ? {
            type: 'organization' as const,
            organization_id: organizationId,
            individual_profile_id: null,
            display_name: beneficiaryName,
            relationship_to_deceased: null,
          }
        : {
            type: 'individual' as const,
            organization_id: null,
            individual_profile_id: user!.id,
            display_name: beneficiaryName,
            relationship_to_deceased: relationship,
          };

    const { error: beneficiaryError } = await supabase
      .from('beneficiaries')
      .update(beneficiaryUpdate)
      .eq('campaign_id', campaignId)
      .eq('is_active', true);

    if (beneficiaryError) {
      console.error('[update-campaign]', beneficiaryError);
      return fail('save_failed', undefined, beneficiaryError.message);
    }

    revalidatePath('/dashboard');
    revalidatePath(`/dashboard/campaigns/${campaignId}/edit`);
    redirect('/dashboard');
    },
    echoFields(formData, ECHO_FIELDS),
  );
}
