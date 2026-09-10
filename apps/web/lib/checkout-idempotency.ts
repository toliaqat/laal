/**
 * Idempotency key derivation for donation Checkout Sessions.
 *
 * WHY THIS FILE EXISTS AT ALL
 * ---------------------------
 * Stripe treats a repeated idempotency key as "you already asked me this" and
 * replays the FIRST response. That is exactly what we want for an impatient
 * double-click, and catastrophic for anything else: a key shared by two
 * different supporters hands supporter B supporter A's Checkout Session, and a
 * Session can only be paid once — so one gift silently disappears, with no
 * error and nothing in the logs.
 *
 * The first implementation hashed the *form values* plus a shared wall-clock
 * 10-minute bucket. For the typical guest (blank name, blank email, blank
 * message, no account, preset amount) that hash is byte-identical between
 * strangers, so a shared link driving a burst of default-amount gifts collides
 * immediately. Two rules follow, and both are enforced here:
 *
 *  1. **Entropy per attempt, not per value.** The key is salted with a `nonce`
 *     minted once per form render in the browser (see components/donate-form.tsx).
 *     Same render + same values => same key (double-click reuses one Session);
 *     two visitors => two nonces => never the same key, no matter how identical
 *     their forms are.
 *  2. **Cover the whole request, mechanically.** The key hashes the *actual
 *     Stripe request payload* rather than a hand-listed subset of it. Reusing a
 *     key with different parameters is a Stripe idempotency ERROR the supporter
 *     sees as "we couldn't start your secure payment", and the hand-listed
 *     version had already drifted: `is_anonymous` and `locale` reached Stripe
 *     but were never hashed. Hashing the payload means a new field cannot be
 *     forgotten — there is no list to keep in sync.
 *
 * Deliberately free of `server-only`, `next` and the Stripe SDK so it runs
 * under `node --test` (see checkout-idempotency.test.ts).
 */

import { createHash, randomUUID } from 'node:crypto';

/**
 * Checkout Session lifetime is quantized to this many seconds. A retried
 * submit must send byte-identical parameters, and a per-second `expires_at`
 * would make Stripe reject the reused key instead of replaying the Session.
 */
const EXPIRY_BUCKET_SECONDS = 600; // 10 minutes

/** Stripe requires >= 30 minutes; 31 leaves a little clock-skew headroom. */
const EXPIRY_LEAD_SECONDS = 31 * 60;

/**
 * Quantized `expires_at` (unix seconds) for a Checkout Session. Because it is
 * part of the hashed payload, a double-click that straddles a bucket boundary
 * simply produces a second key — two Sessions, one paid — instead of a Stripe
 * idempotency error. That is the failure mode we want.
 */
export function checkoutExpiresAt(nowMs: number = Date.now()): number {
  return (
    Math.ceil(nowMs / 1000 / EXPIRY_BUCKET_SECONDS) * EXPIRY_BUCKET_SECONDS +
    EXPIRY_LEAD_SECONDS
  );
}

/**
 * A browser-minted nonce is client input, so it is only trusted for its shape.
 * A UUID (or 16-32 hex bytes) is what donate-form.tsx sends; anything else —
 * including the no-JavaScript case, where the hidden field arrives empty — is
 * replaced by a server-side random value. That degrades to "no double-click
 * protection", never to "shared key".
 */
export function normalizeAttemptNonce(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return /^[0-9a-fA-F-]{16,64}$/.test(value) ? value.toLowerCase() : randomUUID();
}

/** Canonical JSON: object keys sorted, so key order can never change the hash. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined) continue; // absent === not sent to Stripe
      out[key] = canonicalize(source[key]);
    }
    return out;
  }
  return value;
}

/**
 * Derive the Stripe idempotency key for one checkout attempt.
 *
 * @param nonce   per-form-render entropy (see {@link normalizeAttemptNonce})
 * @param payload the exact object handed to `checkout.sessions.create`
 */
export function deriveIdempotencyKey(nonce: string, payload: unknown): string {
  return createHash('sha256')
    .update(`laal.checkout.v2\n${nonce}\n${JSON.stringify(canonicalize(payload))}`)
    .digest('hex');
}
