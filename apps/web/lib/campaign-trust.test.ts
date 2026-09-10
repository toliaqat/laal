import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CampaignTrust } from '@laal/types';
import {
  beneficiaryName,
  deathVerifierType,
  startedBy,
  trustBadges,
} from './campaign-trust.ts';

/**
 * These assertions are the trust contract of the public fundraiser page: a
 * badge must never claim more than the projection proves. The
 * "reviewed but nothing verified" case is the one that used to ship a
 * hard-coded "Verified fundraiser" chip.
 */

function row(overrides: Partial<CampaignTrust> = {}): CampaignTrust {
  return {
    campaign_id: 'c1',
    slug: 'in-memory-of-ahmed',
    reviewed: false,
    beneficiary_type: null,
    beneficiary_display_name: null,
    organization_name: null,
    organization_type: null,
    death_verified: false,
    relationship_verified: false,
    death_verifier_type: null,
    organizer_first_name: null,
    organizer_relationship: null,
    ...overrides,
  };
}

test('no projection row means no trust claims at all', () => {
  assert.deepEqual(trustBadges(null), []);
  assert.equal(deathVerifierType(null), null);
  assert.equal(beneficiaryName(null), null);
  assert.equal(startedBy(null), null);
});

test('an activated fundraiser with no approved verification claims only review', () => {
  assert.deepEqual(trustBadges(row({ reviewed: true })), ['reviewed']);
});

test('an approved death verification adds "need verified"', () => {
  assert.deepEqual(trustBadges(row({ reviewed: true, death_verified: true })), [
    'reviewed',
    'needVerified',
  ]);
});

test('relationship approval shows "family verified" for individuals only', () => {
  const individual = row({
    reviewed: true,
    death_verified: true,
    beneficiary_type: 'individual',
    relationship_verified: true,
  });
  assert.deepEqual(trustBadges(individual), [
    'reviewed',
    'needVerified',
    'familyVerified',
  ]);

  // Organizations have no relationship check (they are vetted at onboarding),
  // so even a stray approved row must not produce a family claim.
  const org = row({
    reviewed: true,
    death_verified: true,
    beneficiary_type: 'organization',
    relationship_verified: true,
  });
  assert.deepEqual(trustBadges(org), ['reviewed', 'needVerified']);
});

test('a verifier organization type is named only when the death is verified', () => {
  assert.equal(
    deathVerifierType(row({ death_verified: true, death_verifier_type: 'embassy' })),
    'embassy',
  );
  // Stale verifier type without an approval must never surface.
  assert.equal(
    deathVerifierType(row({ death_verifier_type: 'embassy' })),
    null,
  );
  // Admin-confirmed from documents: no institution to claim.
  assert.equal(deathVerifierType(row({ death_verified: true })), null);
});

test('organization beneficiaries are named by the organization', () => {
  assert.equal(
    beneficiaryName(
      row({
        beneficiary_type: 'organization',
        organization_name: 'Servilusa',
        beneficiary_display_name: 'Servilusa (stale copy)',
      }),
    ),
    'Servilusa',
  );
  assert.equal(
    beneficiaryName(
      row({ beneficiary_type: 'individual', beneficiary_display_name: 'Family of Ahmed K.' }),
    ),
    'Family of Ahmed K.',
  );
});

test('an unverified partner organization is not named at all', () => {
  // The projection supplies organization_name only for a VERIFIED org (0013
  // restates organizations_select_public's status gate as a join condition,
  // since RLS does not apply inside a definer view). beneficiary_display_name is
  // a stale copy of that same org name, so falling back to it would publish the
  // pending/suspended partner the gate withheld.
  assert.equal(
    beneficiaryName(
      row({
        beneficiary_type: 'organization',
        organization_name: null,
        beneficiary_display_name: 'Some Pending Funeral Home',
      }),
    ),
    null,
  );
  // A family's own display name is unaffected.
  assert.equal(
    beneficiaryName(
      row({
        beneficiary_type: 'individual',
        organization_name: null,
        beneficiary_display_name: 'Family of Ahmed K.',
      }),
    ),
    'Family of Ahmed K.',
  );
});

test('"started by" needs a first name, and treats blank relationship as absent', () => {
  assert.deepEqual(
    startedBy(row({ organizer_first_name: 'Ahmed', organizer_relationship: 'brother' })),
    { name: 'Ahmed', relationship: 'brother' },
  );
  assert.deepEqual(startedBy(row({ organizer_first_name: 'Ahmed' })), {
    name: 'Ahmed',
    relationship: null,
  });
  assert.equal(startedBy(row({ organizer_relationship: 'brother' })), null);
  assert.equal(startedBy(row({ organizer_first_name: '   ' })), null);
});
