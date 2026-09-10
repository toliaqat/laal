/**
 * Shape rules for `beneficiaries.display_name` — the one free-text, human name
 * that `public.campaign_trust_public` (0013_public_trust_projection.sql) hands
 * to `anon`. Because that view is API-exposed and the anon key ships in the
 * mobile app, anything contact-shaped typed here becomes world-readable *and*
 * world-searchable, so the database bounds the column with the
 * `beneficiaries_display_name_public_shape` CHECK constraint.
 *
 * That constraint is the backstop; this module is the human half. It mirrors
 * the SQL rule exactly so the organizer gets told what to change instead of a
 * raw check violation surfacing as a generic "we couldn't save that".
 *
 * The SQL is authoritative. If the two ever disagree, fix this file — not the
 * migration.
 *
 * Documented shape (individual beneficiaries only — an organization's
 * display_name is a copy of `organizations.name` and is exempt):
 *   * 2–60 characters after trimming;
 *   * no digits, ASCII or Arabic-Indic (٠-٩) or Extended Arabic-Indic (۰-۹);
 *   * no '@';
 *   * no `http(s)://` and no `www.` (case-insensitive);
 *   * no control characters, so it stays a single display line.
 *
 * Deliberately free of `next` and of `import 'server-only'` so it stays
 * importable from both client form components and server actions, and stays
 * unit-testable under plain `node --test`.
 */

export const BENEFICIARY_NAME_MIN = 2;
export const BENEFICIARY_NAME_MAX = 60;

/** Why a display name fails the public shape — one reason, first match wins. */
export type BeneficiaryNameProblem =
  | 'too_short'
  | 'too_long'
  | 'has_digits'
  | 'has_at_sign'
  | 'has_url'
  | 'has_control_chars';

export type BeneficiaryNameCheck =
  | { ok: true; value: string }
  | { ok: false; problem: BeneficiaryNameProblem };

// ASCII, Arabic-Indic (U+0660–U+0669) and Extended Arabic-Indic
// (U+06F0–U+06F9) digits — mirrors `!~ '[0-9٠-٩۰-۹]'`.
const DIGITS = /[0-9٠-٩۰-۹]/u;
// Mirrors `!~* '(https?://|www\.)'`.
const URLISH = /(https?:\/\/|www\.)/iu;
// Mirrors `!~ '[[:cntrl:]]'`: C0 controls, DEL, and the C1 range Postgres's
// wide-character cntrl class also covers.
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;

/**
 * Check a display name against the public shape. Pass the raw field value —
 * it is trimmed here, the same way the action trims before writing, so the
 * string checked is the string the constraint will see.
 */
export function checkBeneficiaryDisplayName(
  raw: string,
): BeneficiaryNameCheck {
  const value = raw.trim();
  // Postgres `char_length` counts characters, so count code points rather than
  // UTF-16 units.
  const length = [...value].length;
  // Length first: it is the rule an organizer is most likely to hit, and
  // reporting "too short" for "" beats reporting a URL problem.
  if (length < BENEFICIARY_NAME_MIN) return { ok: false, problem: 'too_short' };
  if (length > BENEFICIARY_NAME_MAX) return { ok: false, problem: 'too_long' };
  if (DIGITS.test(value)) return { ok: false, problem: 'has_digits' };
  if (value.includes('@')) return { ok: false, problem: 'has_at_sign' };
  if (URLISH.test(value)) return { ok: false, problem: 'has_url' };
  if (CONTROL.test(value)) return { ok: false, problem: 'has_control_chars' };
  return { ok: true, value };
}

/** Convenience predicate for callers that only need yes/no. */
export function isValidBeneficiaryDisplayName(raw: string): boolean {
  return checkBeneficiaryDisplayName(raw).ok;
}
