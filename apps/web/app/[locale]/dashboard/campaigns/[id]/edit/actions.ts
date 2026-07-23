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
import type { IntendedUse } from '@laal/types';

const INTENDED_USES: IntendedUse[] = ['local_burial', 'repatriation'];

const EDITABLE_STATUSES = ['draft', 'pending_review'] as const;

/**
 * Update a campaign and its active beneficiary. Ownership and editable status
 * are re-checked server-side; the client is never trusted. Redirects to
 * /dashboard on success.
 */
export async function updateCampaign(formData: FormData): Promise<void> {
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
  if (!title) throw new Error('Title is required.');
  if (!Number.isFinite(goalAmount) || goalAmount <= 0) {
    throw new Error('Target amount must be a positive number.');
  }

  let organizationId: string | null = null;
  let displayName = '';
  let relationship: string | null = null;

  if (beneficiaryKind === 'organization') {
    organizationId = String(formData.get('organization_id') ?? '').trim();
    if (!organizationId) {
      throw new Error('Please select a partner organisation.');
    }
  } else if (beneficiaryKind === 'individual') {
    displayName = String(formData.get('display_name') ?? '').trim();
    relationship =
      String(formData.get('relationship_to_deceased') ?? '').trim() || null;
    if (!displayName) {
      throw new Error('Beneficiary display name is required.');
    }
  } else {
    throw new Error('Please choose who receives the funds.');
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
      throw new Error('That organisation cannot be selected as a beneficiary.');
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
    })
    .eq('id', campaignId);

  if (campaignError) {
    throw new Error(campaignError.message);
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
    throw new Error(beneficiaryError.message);
  }

  revalidatePath('/dashboard');
  revalidatePath(`/dashboard/campaigns/${campaignId}/edit`);
  redirect('/dashboard');
}
