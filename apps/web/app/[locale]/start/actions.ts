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
import { echoFields, fail, type ActionState } from '@/lib/action-result';
import { checkBeneficiaryDisplayName } from '@/lib/beneficiary-name';
import { runAction } from '@/lib/run-action';
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
 * /dashboard on success; recoverable problems come back as ActionState.
 */
// Text fields echoed back on failure so the form can restore typed input
// (React resets uncontrolled inputs after a form action completes).
const ECHO_FIELDS = [
  'title',
  'deceased_name',
  'story',
  'goal_amount',
  'death_country',
  'death_city',
  'repatriation_city',
  'display_name',
  'relationship_to_deceased',
] as const;

export async function createCampaign(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(
    'create-campaign',
    async () => {
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
    if (!title) return fail('title_required');
    if (!deceasedName) return fail('deceased_name_required');
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
      // The public trust projection hands this string to anon, so the database
      // bounds its shape (beneficiaries_display_name_public_shape, 0013). Check
      // the same rule here so the organizer is told what to change instead of a
      // raw check violation coming back as a generic "couldn't save".
      if (!checkBeneficiaryDisplayName(displayName).ok) {
        return fail('beneficiary_name_shape');
      }
    } else {
      return fail('beneficiary_kind_required');
    }

    const supabase = await createServerSupabase();

    // Check the org BEFORE creating the campaign, so a recoverable rejection
    // doesn't leave an orphaned campaign row behind.
    let beneficiaryName = displayName;
    if (beneficiaryKind === 'organization') {
      const { data: org } = await supabase
        .from('organizations')
        .select('name, status, can_be_beneficiary')
        .eq('id', organizationId)
        .maybeSingle();
      // Only a verified, beneficiary-capable org may receive funds.
      if (!org || org.status !== 'verified' || !org.can_be_beneficiary) {
        return fail('org_not_selectable');
      }
      beneficiaryName = org.name;
    }

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
      console.error('[create-campaign]', campaignError);
      return fail('save_failed');
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
      console.error('[create-campaign]', beneficiaryError);
      return fail('save_failed');
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
    },
    echoFields(formData, ECHO_FIELDS),
  );
}
