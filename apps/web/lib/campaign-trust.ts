import type { CampaignTrust } from '@laal/types';

/**
 * Turn one row of the public trust projection into the badges a fundraiser page
 * may honestly show. Pure and dependency-free so it can be unit-tested (and so
 * the mobile screen can mirror it exactly — see
 * apps/mobile/app/campaigns/[slug].tsx).
 *
 * The rule that matters: **never render a stronger claim than the data
 * supports.** An admin can activate a fundraiser before the death certificate
 * is approved, so "reviewed" and "verified" are different facts and get
 * different badges. Wording comes from BRAND.md.
 */
export type TrustBadge =
  /** An admin read this fundraiser and published it. Claims nothing more. */
  | 'reviewed'
  /** An approved `death` verification exists — the need itself is confirmed. */
  | 'needVerified'
  /**
   * Individual beneficiaries only: an approved `relationship` verification
   * exists, so the person receiving funds is a confirmed family member.
   * Organization beneficiaries are vetted at onboarding and have no
   * relationship check (ARCHITECTURE.md §4), so this badge never applies to
   * them — showing it would imply a check we never ran.
   */
  | 'familyVerified';

export function trustBadges(trust: CampaignTrust | null): TrustBadge[] {
  if (!trust) return [];
  const badges: TrustBadge[] = [];
  if (trust.reviewed) badges.push('reviewed');
  if (trust.death_verified) badges.push('needVerified');
  if (trust.beneficiary_type === 'individual' && trust.relationship_verified) {
    badges.push('familyVerified');
  }
  return badges;
}

/**
 * The kind of body that confirmed the death, but only when we may say so: the
 * death must actually be verified, and the verifier must have been an
 * organization (admins confirming from documents leave this null, and we then
 * name no institution).
 */
export function deathVerifierType(
  trust: CampaignTrust | null,
): string | null {
  if (!trust?.death_verified) return null;
  return trust.death_verifier_type ?? null;
}

/**
 * Who receives the support. For an organization beneficiary the org's own name
 * is the only acceptable source, with **no fallback** to
 * `beneficiary_display_name`: that column is a copy of the org name taken at
 * creation time, and the projection supplies `organization_name` only for a
 * *verified* org (0013 restates `organizations_select_public`'s status gate as a
 * join condition, because RLS does not apply inside a definer view). Falling
 * back would therefore publish exactly the name that gate refused — a pending
 * or suspended partner's. No name is the correct output there; the page still
 * says a partner organization receives the funds.
 *
 * For a family it is the display name they chose ("Family of Ahmed K."), whose
 * shape is bounded by beneficiaries_display_name_public_shape.
 */
export function beneficiaryName(trust: CampaignTrust | null): string | null {
  if (!trust) return null;
  if (trust.beneficiary_type === 'organization') {
    return trust.organization_name ?? null;
  }
  return trust.beneficiary_display_name ?? null;
}

/** "Started by Ahmed, brother" — rendered only when we have a first name. */
export function startedBy(
  trust: CampaignTrust | null,
): { name: string; relationship: string | null } | null {
  const name = trust?.organizer_first_name?.trim();
  if (!name) return null;
  return {
    name,
    relationship: trust?.organizer_relationship?.trim() || null,
  };
}
