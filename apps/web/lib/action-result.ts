/**
 * Shared result contract for server actions.
 *
 * Recoverable failures are RETURNED (never thrown) as `fail(code)` so forms can
 * render a translated message from the `errors.*` i18n namespace while the
 * user's input stays in place. Shared helpers that sit below an action (cover
 * image validation, auth guards) throw {@link ActionError}, which the
 * `runAction` boundary converts back into a `fail`. Anything else that throws
 * is a genuine bug and surfaces as the generic `unexpected` code.
 *
 * This module is deliberately free of `next` imports so it stays unit-testable
 * under `node --test` (see run-action.ts for the Next-coupled wrapper).
 */

export type ErrorCode =
  // Generic
  | 'unexpected'
  | 'not_authorized'
  | 'save_failed'
  // Start / edit campaign
  | 'title_required'
  | 'deceased_name_required'
  | 'goal_amount_invalid'
  | 'beneficiary_kind_required'
  | 'beneficiary_org_required'
  | 'beneficiary_name_required'
  | 'beneficiary_name_shape'
  | 'org_not_selectable'
  // Cover image
  | 'cover_missing'
  | 'cover_too_large'
  | 'cover_invalid_type'
  // Documents
  | 'file_required'
  | 'file_too_large'
  | 'file_invalid_type'
  | 'doc_type_invalid'
  // Campaign updates (organizer posts)
  | 'update_body_required'
  | 'update_body_too_long'
  | 'update_not_found'
  // Donations
  | 'donation_amount_invalid'
  | 'campaign_not_found'
  | 'campaign_not_accepting'
  | 'checkout_failed'
  // Organizations
  | 'org_name_required'
  | 'org_type_invalid'
  | 'org_status_invalid'
  | 'org_not_found'
  | 'org_not_designated'
  | 'onboarding_link_failed'
  // Invites
  | 'email_invalid'
  | 'invite_not_found'
  | 'invite_email_mismatch'
  | 'invite_used'
  | 'invite_expired'
  | 'invite_email_failed'
  // Verifications
  | 'verification_not_found'
  | 'verification_already_reviewed'
  | 'verification_status_invalid'
  // Admin campaign state
  | 'campaign_not_pending'
  | 'campaign_not_active'
  | 'campaign_not_paused'
  | 'campaign_already_closed'
  // Fund releases
  | 'release_gate_not_satisfied'
  | 'release_no_stripe_account'
  | 'release_nothing_left'
  | 'release_already_claimed'
  | 'payout_record_failed'
  | 'transfer_failed'
  | 'beneficiary_not_found'
  // Refunds
  | 'donation_not_found'
  | 'refund_only_succeeded'
  | 'refund_no_payment'
  | 'refund_after_release'
  | 'refund_failed'
  | 'refund_record_failed'
  | 'refund_already_done'
  // Accounts
  | 'role_invalid'
  | 'last_admin';

/** ICU message parameters, e.g. `{ maxMb: 20 }` for `file_too_large`. */
export type ErrorValues = Record<string, string | number>;

export type ActionState =
  | { ok: true; message?: string }
  | {
      ok: false;
      code: ErrorCode;
      /** ICU params for the translated message. */
      values?: ErrorValues;
      /**
       * Raw underlying message (Supabase/Stripe).
       *
       * IMPORTANT: `showDetail` on `FormAlert` controls *rendering* only — this
       * string is always serialized to the client. So only pass a `detail` from
       * an action whose every caller is an admin. On organizer-, supporter- or
       * partner-facing actions, `console.error` the provider error instead and
       * return `fail(code)` with no detail, or Postgres and Stripe internals
       * (constraint names, RLS messages, schema hints) reach the browser.
       */
      detail?: string;
      /**
       * Echo of the submitted text fields. React 19 resets uncontrolled
       * inputs after a form action completes, so input-heavy forms feed these
       * back as defaultValues to keep the user's typing on failure.
       */
      fields?: Record<string, string>;
    }
  | null; // initial useActionState value

/**
 * A typed, recoverable failure thrown by shared helpers below the action
 * boundary. `runAction` converts it into `fail(code, values, detail)`.
 */
export class ActionError extends Error {
  readonly code: ErrorCode;
  readonly values?: ErrorValues;

  // No TS parameter properties here — they break Node's strip-only TS mode,
  // which runs these files directly under `node --test`.
  constructor(code: ErrorCode, values?: ErrorValues, detail?: string) {
    super(detail ?? code);
    this.name = 'ActionError';
    this.code = code;
    this.values = values;
  }
}

export function fail(
  code: ErrorCode,
  values?: ErrorValues,
  detail?: string,
): ActionState {
  return { ok: false, code, values, detail };
}

export function succeed(message?: string): ActionState {
  return { ok: true, message };
}

/** Snapshot the named text fields from a FormData for echo-back on failure. */
export function echoFields(
  formData: FormData,
  names: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === 'string') out[name] = value;
  }
  return out;
}
