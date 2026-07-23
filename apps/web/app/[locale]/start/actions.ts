'use server';

import { redirect } from 'next/navigation';
import {
  createAdminSupabase,
  createServerSupabase,
  getCurrentUser,
} from '@/lib/supabase/server';
import {
  assertValidCoverFile,
  hasCoverFile,
  uploadCoverImage,
} from '@/lib/cover-image';
import { normalizeCurrency } from '@/lib/stripe';
import type { IntendedUse } from '@laal/types';

const INTENDED_USES: IntendedUse[] = ['local_burial', 'repatriation'];

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || 'campaign'}-${suffix}`;
}

/**
 * Create a campaign (status 'pending_review') for the current user and its
 * single active beneficiary (a verified org OR an individual). Redirects to
 * /dashboard on success.
 */
export async function createCampaign(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const title = String(formData.get('title') ?? '').trim();
  const deceasedName = String(formData.get('deceased_name') ?? '').trim();
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

  // Optional cover image. Validate type/size up front so a bad file fails
  // before we create anything; the actual upload happens once we have an id.
  const coverField = formData.get('cover_image');
  const coverFile = hasCoverFile(coverField)
    ? assertValidCoverFile(coverField)
    : null;

  // ---- Validation ----
  if (!title) throw new Error('Title is required.');
  if (!deceasedName) throw new Error('Name of the deceased is required.');
  if (!Number.isFinite(goalAmount) || goalAmount <= 0) {
    throw new Error('Goal amount must be a positive number.');
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

  const supabase = await createServerSupabase();

  const slug = slugify(title);

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      slug,
      organizer_id: user!.id,
      title,
      story: story || null,
      deceased_name: deceasedName,
      death_country: deathCountry || null,
      death_city: deathCity || null,
      repatriation_city:
        intendedUse === 'repatriation' ? repatriationCity || null : null,
      intended_use: intendedUse,
      goal_amount: goalAmount,
      currency,
      status: 'pending_review',
    })
    .select('id')
    .single();

  if (campaignError || !campaign) {
    throw new Error(campaignError?.message ?? 'Failed to create campaign.');
  }

  // Upload the cover image (best-effort: the campaign already exists and the
  // image is editable later, so an R2 hiccup must not lose the submission).
  if (coverFile) {
    try {
      const url = await uploadCoverImage(campaign.id, coverFile);
      await supabase
        .from('campaigns')
        .update({ cover_image_url: url })
        .eq('id', campaign.id);
    } catch {
      // Swallow — organizer can add a photo from the edit screen.
    }
  }

  let beneficiaryName = displayName;
  if (beneficiaryKind === 'organization') {
    const { data: org } = await supabase
      .from('organizations')
      .select('name, status, can_be_beneficiary')
      .eq('id', organizationId)
      .maybeSingle();
    // Only a verified, beneficiary-capable org may receive funds.
    if (!org || org.status !== 'verified' || !org.can_be_beneficiary) {
      throw new Error('That organisation cannot be selected as a beneficiary.');
    }
    beneficiaryName = org.name;
  }

  const { error: beneficiaryError } = await supabase
    .from('beneficiaries')
    .insert({
      campaign_id: campaign.id,
      type: beneficiaryKind === 'organization' ? 'organization' : 'individual',
      organization_id:
        beneficiaryKind === 'organization' ? organizationId : null,
      individual_profile_id:
        beneficiaryKind === 'individual' ? user!.id : null,
      display_name: beneficiaryName,
      relationship_to_deceased:
        beneficiaryKind === 'individual' ? relationship : null,
      is_active: true,
    });

  if (beneficiaryError) {
    throw new Error(beneficiaryError.message);
  }

  // Seed the verification gate so the admin has something to review. The death
  // check always applies; individual beneficiaries also need a relationship
  // check (orgs are vetted at onboarding). Inserted via the service-role client
  // because verifications are admin-writable only under RLS.
  const admin = createAdminSupabase();
  const verifications: {
    campaign_id: string;
    type: 'death' | 'relationship';
    status: 'pending';
    verifier_type: 'admin';
  }[] = [
    {
      campaign_id: campaign.id,
      type: 'death',
      status: 'pending',
      verifier_type: 'admin',
    },
  ];
  if (beneficiaryKind === 'individual') {
    verifications.push({
      campaign_id: campaign.id,
      type: 'relationship',
      status: 'pending',
      verifier_type: 'admin',
    });
  }
  await admin.from('verifications').insert(verifications);

  redirect('/dashboard');
}
