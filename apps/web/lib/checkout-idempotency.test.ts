import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkoutExpiresAt,
  deriveIdempotencyKey,
  normalizeAttemptNonce,
} from './checkout-idempotency.ts';

/**
 * The bug these tests exist for: the idempotency key used to be a hash of the
 * FORM VALUES plus a shared 10-minute wall-clock bucket. Two anonymous
 * supporters giving the same preset amount to the same fundraiser produce
 * identical form values, so they produced an identical key — and Stripe replays
 * the first caller's Checkout Session for a repeated key. A Session can be paid
 * once, so one of the two gifts vanished with no error anywhere.
 *
 * Typecheck, lint, the test suite and a production build were all green while
 * that was true. These assertions are the thing that makes it stay dead, so
 * they are written as the three real-world sequences rather than as unit trivia:
 *
 *  (a) one supporter double-clicks submit  -> SAME key (reuse the Session)
 *  (b) one supporter submits, cancels at Stripe, submits a different amount
 *                                          -> DIFFERENT key (a second Session)
 *  (c) two different supporters submit identical values at the same moment
 *                                          -> DIFFERENT keys, always
 */

/** A Stripe payload shaped like the one lib/stripe.ts builds. */
function payload(over: Record<string, unknown> = {}) {
  return {
    mode: 'payment',
    locale: 'en',
    customer_email: undefined,
    expires_at: 1_700_002_460,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: 2500,
          product_data: { name: 'Support — In memory of Ahmed' },
        },
      },
    ],
    metadata: {
      campaign_id: 'c1',
      donor_name: '',
      donor_profile_id: '',
      is_anonymous: 'false',
      message: '',
      locale: 'en',
    },
    payment_intent_data: { metadata: { campaign_id: 'c1' } },
    success_url: 'https://laal.app/en/campaigns/x/thank-you?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://laal.app/en/campaigns/x?checkout=cancelled#help',
    ...over,
  };
}

const NONCE_A = '5f8e1b2c9d4a47f0a1b2c3d4e5f60718';
const NONCE_B = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

test('(a) a double-click on one form render reuses the same key', () => {
  // Same render => same nonce; nothing about the form changed between clicks.
  assert.equal(
    deriveIdempotencyKey(NONCE_A, payload()),
    deriveIdempotencyKey(NONCE_A, payload()),
  );
});

test('(a) key is stable under object key ordering, not just deep equality', () => {
  // The payload is assembled by hand in lib/stripe.ts; if a reorder there
  // changed the key, a double-click would create a second Session.
  const reordered = {
    cancel_url: payload().cancel_url,
    metadata: {
      locale: 'en',
      message: '',
      is_anonymous: 'false',
      donor_profile_id: '',
      donor_name: '',
      campaign_id: 'c1',
    },
    ...payload(),
  };
  assert.equal(
    deriveIdempotencyKey(NONCE_A, reordered),
    deriveIdempotencyKey(NONCE_A, payload()),
  );
});

test('(b) cancel, then submit a changed amount => different key', () => {
  const changed = payload({
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: 5000, // €25 -> €50
          product_data: { name: 'Support — In memory of Ahmed' },
        },
      },
    ],
  });
  assert.notEqual(
    deriveIdempotencyKey(NONCE_A, payload()),
    deriveIdempotencyKey(NONCE_A, changed),
  );
});

test('(c) two supporters with byte-identical forms never share a key', () => {
  // The entire point. Identical payload, different per-render nonce.
  assert.notEqual(
    deriveIdempotencyKey(NONCE_A, payload()),
    deriveIdempotencyKey(NONCE_B, payload()),
  );
});

test('(c) 500 concurrent identical submits produce 500 distinct keys', () => {
  const keys = new Set(
    Array.from({ length: 500 }, () =>
      deriveIdempotencyKey(normalizeAttemptNonce(undefined), payload()),
    ),
  );
  assert.equal(keys.size, 500);
});

/**
 * Bug 2: `is_anonymous` and `locale` reached Stripe but were absent from the
 * old hand-listed key, so "submit blank-named, cancel, tick anonymous, submit
 * again" reused a key with changed parameters — a Stripe idempotency error the
 * supporter saw as "we couldn't start your secure payment". Hashing the whole
 * payload makes every such field covered by construction. These two cases are
 * the exact sequences from the report.
 */
test('every parameter that reaches Stripe changes the key — anonymity flip', () => {
  const anon = payload({
    metadata: { ...payload().metadata, is_anonymous: 'true' },
  });
  assert.notEqual(
    deriveIdempotencyKey(NONCE_A, payload()),
    deriveIdempotencyKey(NONCE_A, anon),
  );
});

test('every parameter that reaches Stripe changes the key — language switch', () => {
  const urdu = payload({
    locale: 'auto',
    metadata: { ...payload().metadata, locale: 'ur' },
    success_url:
      'https://laal.app/ur/campaigns/x/thank-you?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://laal.app/ur/campaigns/x?checkout=cancelled#help',
  });
  assert.notEqual(
    deriveIdempotencyKey(NONCE_A, payload()),
    deriveIdempotencyKey(NONCE_A, urdu),
  );
});

test('an absent optional field is not the same as an empty one', () => {
  assert.notEqual(
    deriveIdempotencyKey(NONCE_A, payload({ customer_email: 'a@b.co' })),
    deriveIdempotencyKey(NONCE_A, payload()),
  );
});

test('key is a hex digest inside Stripe’s 255-character limit', () => {
  const key = deriveIdempotencyKey(NONCE_A, payload());
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.ok(key.length <= 255);
});

// --- nonce normalization: client input, trusted only for shape -------------

test('a UUID or hex nonce from the form is kept (so double-clicks reuse)', () => {
  assert.equal(normalizeAttemptNonce(NONCE_A), NONCE_A);
  assert.equal(normalizeAttemptNonce(NONCE_B), NONCE_B);
  assert.equal(normalizeAttemptNonce(` ${NONCE_B.toUpperCase()} `), NONCE_B);
});

test('a missing or junk nonce degrades to fresh entropy, never a shared key', () => {
  // The no-JavaScript submit, and anything hand-crafted. Losing double-click
  // protection is acceptable; sharing a key with another supporter is not.
  for (const junk of [undefined, null, '', '   ', 'x', 'not-a-nonce!', 42, {}]) {
    const first = normalizeAttemptNonce(junk);
    const second = normalizeAttemptNonce(junk);
    assert.match(first, /^[0-9a-f-]{16,64}$/);
    assert.notEqual(first, second);
  }
});

// --- expiry quantization ---------------------------------------------------

test('expires_at is quantized, so a double-click sends identical parameters', () => {
  const t0 = 1_700_000_000_000;
  assert.equal(checkoutExpiresAt(t0), checkoutExpiresAt(t0 + 5_000));
});

test('expires_at is always at least Stripe’s 30-minute minimum ahead', () => {
  for (const offset of [0, 1, 59_000, 599_000, 601_000]) {
    const now = 1_700_000_000_000 + offset;
    const ahead = checkoutExpiresAt(now) - Math.floor(now / 1000);
    assert.ok(ahead >= 30 * 60, `only ${ahead}s ahead`);
  }
});
