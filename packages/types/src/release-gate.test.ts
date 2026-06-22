import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canReleaseFunds, type ReleaseGateInput } from './index.ts';

// The release gate is the platform's single trust rule (ARCHITECTURE.md §4):
// funds may move only when the death is verified AND the beneficiary has
// finished Stripe onboarding — and, for individuals, a relationship check too.
// These tests pin that rule so a refactor can't silently loosen it.

const base: ReleaseGateInput = {
  beneficiaryType: 'organization',
  beneficiaryOnboardingComplete: true,
  deathVerification: 'approved',
  relationshipVerification: null,
};

test('organization: passes with onboarding done + death approved', () => {
  assert.equal(canReleaseFunds(base), true);
});

test('organization: relationship verification is irrelevant', () => {
  assert.equal(
    canReleaseFunds({ ...base, relationshipVerification: 'rejected' }),
    true,
  );
});

test('blocked when beneficiary onboarding is incomplete', () => {
  assert.equal(
    canReleaseFunds({ ...base, beneficiaryOnboardingComplete: false }),
    false,
  );
});

test('blocked when death is not approved', () => {
  for (const status of ['pending', 'submitted', 'rejected', null] as const) {
    assert.equal(
      canReleaseFunds({ ...base, deathVerification: status }),
      false,
      `death=${status} must block release`,
    );
  }
});

test('individual: requires an approved relationship verification', () => {
  const individual: ReleaseGateInput = {
    beneficiaryType: 'individual',
    beneficiaryOnboardingComplete: true,
    deathVerification: 'approved',
    relationshipVerification: 'approved',
  };
  assert.equal(canReleaseFunds(individual), true);
});

test('individual: blocked when relationship is missing or unapproved', () => {
  const individual: ReleaseGateInput = {
    beneficiaryType: 'individual',
    beneficiaryOnboardingComplete: true,
    deathVerification: 'approved',
    relationshipVerification: null,
  };
  assert.equal(canReleaseFunds(individual), false);
  assert.equal(
    canReleaseFunds({ ...individual, relationshipVerification: 'pending' }),
    false,
  );
});
