import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BENEFICIARY_NAME_MAX,
  checkBeneficiaryDisplayName,
  isValidBeneficiaryDisplayName,
} from './beneficiary-name.ts';

/**
 * These are the same cases the `beneficiaries_display_name_public_shape`
 * constraint (0013_public_trust_projection.sql) was verified against. This
 * validator exists only to say the same thing the database says, earlier and in
 * words a grieving organizer can act on — so if one of these ever diverges,
 * the SQL wins.
 */

test('the intended shape is accepted, in English and Urdu', () => {
  assert.equal(isValidBeneficiaryDisplayName('Family of Ahmed K.'), true);
  assert.equal(isValidBeneficiaryDisplayName('عائلہ احمد'), true);
});

test('surrounding whitespace is trimmed, like btrim in the constraint', () => {
  const result = checkBeneficiaryDisplayName('  Family of Ahmed K.  ');
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value, 'Family of Ahmed K.');
});

test('a single character is too short', () => {
  assert.deepEqual(checkBeneficiaryDisplayName('A'), {
    ok: false,
    problem: 'too_short',
  });
  // Whitespace-only collapses to empty, which is also too short.
  assert.deepEqual(checkBeneficiaryDisplayName('   '), {
    ok: false,
    problem: 'too_short',
  });
});

test('the bound is 60 characters — 60 passes, 61 does not', () => {
  assert.equal(BENEFICIARY_NAME_MAX, 60);
  assert.equal(isValidBeneficiaryDisplayName('a'.repeat(60)), true);
  assert.deepEqual(checkBeneficiaryDisplayName('a'.repeat(61)), {
    ok: false,
    problem: 'too_long',
  });
});

test('a phone number is rejected', () => {
  assert.deepEqual(checkBeneficiaryDisplayName('Ahmed Khan 03001234567'), {
    ok: false,
    problem: 'has_digits',
  });
});

test('Arabic-Indic and Extended Arabic-Indic digits are rejected too', () => {
  assert.deepEqual(checkBeneficiaryDisplayName('احمد ٠٣٠٠١٢٣٤٥٦٧'), {
    ok: false,
    problem: 'has_digits',
  });
  assert.deepEqual(checkBeneficiaryDisplayName('احمد ۰۳۰۰'), {
    ok: false,
    problem: 'has_digits',
  });
});

test('an email address is rejected', () => {
  assert.deepEqual(checkBeneficiaryDisplayName('ahmed.khan@example.com'), {
    ok: false,
    problem: 'has_at_sign',
  });
});

test('a bare www. or https:// link is rejected', () => {
  assert.deepEqual(checkBeneficiaryDisplayName('www.gofundme.com/ahmed'), {
    ok: false,
    problem: 'has_url',
  });
  assert.deepEqual(checkBeneficiaryDisplayName('HTTPS://laal.app/ahmed'), {
    ok: false,
    problem: 'has_url',
  });
});

test('a street address is rejected', () => {
  assert.deepEqual(
    checkBeneficiaryDisplayName('12 Jinnah Road, Lahore'),
    { ok: false, problem: 'has_digits' },
  );
});

test('an embedded newline is rejected so the name stays one line', () => {
  assert.deepEqual(checkBeneficiaryDisplayName('Family of Ahmed\nKhan'), {
    ok: false,
    problem: 'has_control_chars',
  });
  assert.deepEqual(checkBeneficiaryDisplayName('Family of\tAhmed'), {
    ok: false,
    problem: 'has_control_chars',
  });
});
