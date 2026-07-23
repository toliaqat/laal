/**
 * Shared domain types for Laal.
 * Mirrors supabase/migrations/0001_init.sql. Keep in sync with the schema.
 * (Once a Supabase project exists, you can replace the Row types below with
 *  `supabase gen types typescript` output.)
 */

// ============ ENUMS ============
export type UserRole = 'donor' | 'organizer' | 'org_member' | 'admin';
export type OrgType =
  | 'embassy'
  | 'funeral_home'
  | 'charity'
  | 'employer'
  | 'community'
  | 'religious';
export type OrgStatus = 'pending' | 'verified' | 'suspended';
export type CampaignStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'paused'
  | 'completed'
  | 'closed'
  | 'rejected';
export type BeneficiaryType = 'organization' | 'individual';
// The DB enum also has legacy 'family_support' and 'mixed' values; the app
// only offers these two.
export type IntendedUse = 'local_burial' | 'repatriation';
export type VerificationType = 'death' | 'relationship' | 'identity';
export type VerificationStatus =
  | 'pending'
  | 'submitted'
  | 'approved'
  | 'rejected';
export type VerifierType =
  | 'embassy'
  | 'employer'
  | 'funeral_home'
  | 'admin'
  | 'document';
export type DocumentType =
  | 'death_certificate'
  | 'passport'
  | 'national_id'
  | 'noc'
  | 'obituary'
  | 'relationship_proof'
  | 'other';
export type DonationStatus = 'pending' | 'succeeded' | 'refunded' | 'failed';
export type PayoutStatus =
  | 'held'
  | 'scheduled'
  | 'in_transit'
  | 'paid'
  | 'failed'
  | 'cancelled';

// ============ ROW TYPES ============
export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  type: OrgType;
  country: string;
  contact_email: string | null;
  contact_phone: string | null;
  description: string | null;
  logo_url: string | null;
  status: OrgStatus;
  can_be_beneficiary: boolean;
  can_be_verifier: boolean;
  stripe_connect_account_id: string | null;
  stripe_onboarding_complete: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  slug: string;
  organizer_id: string;
  title: string;
  story: string | null;
  cover_image_url: string | null;
  deceased_name: string;
  deceased_dob: string | null;
  deceased_dod: string | null;
  deceased_nationality: string | null;
  death_country: string | null;
  death_city: string | null;
  intended_use: IntendedUse;
  goal_amount: number;
  currency: string;
  amount_raised: number;
  status: CampaignStatus;
  created_at: string;
  published_at: string | null;
  deadline: string | null;
}

export interface Beneficiary {
  id: string;
  campaign_id: string;
  type: BeneficiaryType;
  organization_id: string | null;
  individual_profile_id: string | null;
  display_name: string;
  relationship_to_deceased: string | null;
  stripe_connect_account_id: string | null;
  stripe_onboarding_complete: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Verification {
  id: string;
  campaign_id: string;
  type: VerificationType;
  status: VerificationStatus;
  verifier_type: VerifierType;
  verifier_org_id: string | null;
  reviewed_by: string | null;
  notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Donation {
  id: string;
  campaign_id: string;
  donor_profile_id: string | null;
  donor_name: string | null;
  donor_email: string | null;
  amount: number;
  currency: string;
  platform_fee: number;
  net_amount: number;
  is_anonymous: boolean;
  message: string | null;
  stripe_payment_intent_id: string | null;
  status: DonationStatus;
  created_at: string;
}

/** A supporter following (saving) a campaign. Mirrors campaign_follows. */
export interface CampaignFollow {
  profile_id: string;
  campaign_id: string;
  created_at: string;
}

export interface Payout {
  id: string;
  campaign_id: string;
  beneficiary_id: string;
  amount: number;
  currency: string;
  stripe_transfer_id: string | null;
  stripe_payout_id: string | null;
  status: PayoutStatus;
  released_by: string | null;
  released_at: string | null;
  created_at: string;
}

// ============ DOMAIN LOGIC ============

/** Inputs needed to evaluate whether a campaign's funds may be released. */
export interface ReleaseGateInput {
  beneficiaryType: BeneficiaryType;
  beneficiaryOnboardingComplete: boolean;
  deathVerification: VerificationStatus | null;
  relationshipVerification: VerificationStatus | null;
}

/**
 * The release gate — the single trust rule (see ARCHITECTURE.md §4).
 * Funds may be released when the death is verified and the beneficiary has
 * completed Stripe onboarding. Individual beneficiaries additionally require an
 * approved relationship verification; organizations are vetted at onboarding.
 */
export function canReleaseFunds(input: ReleaseGateInput): boolean {
  if (!input.beneficiaryOnboardingComplete) return false;
  if (input.deathVerification !== 'approved') return false;
  if (input.beneficiaryType === 'individual') {
    return input.relationshipVerification === 'approved';
  }
  return true;
}
