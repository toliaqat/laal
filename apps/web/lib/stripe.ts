import 'server-only';

import Stripe from 'stripe';
import { APP_URL, STRIPE_SECRET_KEY } from '@/lib/env';
import {
  checkoutExpiresAt,
  deriveIdempotencyKey,
} from '@/lib/checkout-idempotency';

let _stripe: Stripe | null = null;

/** Lazily-constructed Stripe client (avoids needing the key at build time). */
export function stripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(STRIPE_SECRET_KEY(), {
      typescript: true,
      appInfo: { name: 'Laal' },
    });
  }
  return _stripe;
}

// ---------------------------------------------------------------------------
// Connect onboarding (beneficiaries) — ARCHITECTURE.md §4 ①
// ---------------------------------------------------------------------------

/** Create an Express connected account for a beneficiary (org or individual). */
export async function createConnectAccount(params: {
  email?: string;
  country?: string; // ISO-2, defaults to platform country
}): Promise<string> {
  const account = await stripe().accounts.create({
    type: 'express',
    email: params.email,
    country: params.country,
    capabilities: { transfers: { requested: true } },
  });
  return account.id;
}

/**
 * Hosted onboarding link where the beneficiary completes KYC + bank details.
 * Defaults to the admin onboarding return/refresh routes; pass a `basePath`
 * (e.g. '/org') so an org member can self-onboard and land back in their portal.
 */
export async function createOnboardingLink(
  accountId: string,
  opts?: { basePath?: string },
): Promise<string> {
  const base = opts?.basePath ?? '/admin/onboarding';
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: `${APP_URL()}${base}/refresh?account=${accountId}`,
    return_url: `${APP_URL()}${base}/return?account=${accountId}`,
  });
  return link.url;
}

/** Whether a connected account can receive transfers (onboarding complete). */
export async function isPayoutReady(accountId: string): Promise<boolean> {
  const account = await stripe().accounts.retrieve(accountId);
  return Boolean(account.payouts_enabled);
}

// ---------------------------------------------------------------------------
// Collect (donation) — ARCHITECTURE.md §4 ② (separate charges & transfers)
// ---------------------------------------------------------------------------

/**
 * Create a Checkout Session for a donation. Funds land in the PLATFORM balance
 * (no transfer_data) and are held until the release gate passes.
 *
 * `locale` is the supporter's current site locale. It matters twice:
 *  - the return URLs must carry the locale segment, because routing is
 *    `localePrefix: 'always'` with `defaultLocale: 'ur'` and no locale
 *    detection — a locale-less `/campaigns/...` URL would dump an English
 *    supporter on the RTL Urdu page right after paying;
 *  - Stripe's own Checkout UI language. Stripe has no Urdu, so `ur` maps to
 *    'auto' (Stripe picks from the browser) rather than forcing English.
 */
export async function createDonationCheckout(params: {
  campaignId: string;
  campaignSlug: string;
  campaignTitle: string;
  amountMinor: number; // smallest currency unit (e.g. cents)
  currency: string;
  /** Site locale of the supporter, e.g. 'en' | 'ur'. */
  locale: string;
  donorEmail?: string;
  /** Display name the supporter typed; published on the supporter wall. */
  donorName?: string;
  /** Signed-in supporter's profile id, so they can see their own support. */
  donorProfileId?: string;
  isAnonymous?: boolean;
  message?: string;
  /** True when checkout started from the mobile app's in-app browser. */
  fromApp?: boolean;
  /**
   * Per-form-render entropy from <DonateForm> (already normalized by the
   * action). The idempotency key is derived from this PLUS a hash of the whole
   * request below, so a double-click replays one Session while two supporters
   * with byte-identical forms can never share one.
   */
  attemptNonce?: string;
}): Promise<{ id: string; url: string | null }> {
  const returnBase = `${APP_URL()}/${params.locale}/campaigns/${params.campaignSlug}`;
  // Built as a named value so the idempotency key can hash THIS OBJECT rather
  // than a hand-maintained list of fields. Anything added below is covered
  // automatically; nothing can silently fall out of the key again (an earlier
  // version omitted `locale` and `is_anonymous`, which Stripe rejects as an
  // idempotency conflict on a reused key).
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    // Stripe supports no Urdu locale; 'auto' avoids forcing English copy.
    locale: params.locale === 'en' ? 'en' : 'auto',
    customer_email: params.donorEmail,
    // Quantized to a 10-minute window (see lib/checkout-idempotency.ts): a
    // retried submit must send IDENTICAL parameters, and a per-second
    // timestamp would make Stripe reject the reused key instead of replaying
    // the existing session.
    expires_at: checkoutExpiresAt(),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: params.currency.toLowerCase(),
          unit_amount: params.amountMinor,
          product_data: {
            // Shown on Stripe's page, its receipt and the supporter's bank
            // statement — BRAND.md bans "Donation" in user-facing copy.
            name: `Support — ${params.campaignTitle}`,
          },
        },
      },
    ],
    metadata: {
      campaign_id: params.campaignId,
      // The name the supporter CHOSE. The webhook publishes this and never
      // customer_details.name (the cardholder's legal name).
      donor_name: params.donorName?.slice(0, 120) ?? '',
      donor_profile_id: params.donorProfileId ?? '',
      is_anonymous: String(Boolean(params.isAnonymous)),
      message: params.message?.slice(0, 450) ?? '',
      locale: params.locale,
    },
    payment_intent_data: {
      metadata: { campaign_id: params.campaignId },
    },
    // `from=app` survives the Stripe round trip so the thank-you page can
    // offer the way back into the Laal app.
    success_url: `${returnBase}/thank-you?session_id={CHECKOUT_SESSION_ID}${
      params.fromApp ? '&from=app' : ''
    }`,
    // Land back on the form with an acknowledgement instead of silence.
    cancel_url: `${returnBase}?checkout=cancelled#help`,
  };

  const session = await stripe().checkout.sessions.create(
    sessionParams,
    params.attemptNonce
      ? {
          idempotencyKey: deriveIdempotencyKey(params.attemptNonce, sessionParams),
        }
      : undefined,
  );
  return { id: session.id, url: session.url };
}

// ---------------------------------------------------------------------------
// Release (transfer) — ARCHITECTURE.md §4 ④
// ---------------------------------------------------------------------------

/** Transfer held platform funds to the beneficiary's connected account. */
export async function transferToBeneficiary(params: {
  amountMinor: number;
  currency: string;
  destinationAccountId: string;
  transferGroup?: string;
  /** Stripe idempotency key — dedupes concurrent/retried release attempts. */
  idempotencyKey?: string;
}): Promise<Stripe.Transfer> {
  return stripe().transfers.create(
    {
      amount: params.amountMinor,
      currency: params.currency.toLowerCase(),
      destination: params.destinationAccountId,
      transfer_group: params.transferGroup,
    },
    params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined,
  );
}

/**
 * Currencies the platform accepts for campaigns/donations. Must stay in sync
 * with the currency <select> options in the campaign forms. Donations resolve
 * their currency from the campaign row, so validating here — at the only point
 * a currency enters the DB — guarantees Stripe never receives an unsupported
 * code (which would fail checkout/transfer for every donor on that campaign).
 */
export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'AED'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Normalize a user-supplied currency to a supported code. Unknown or missing
 * values fall back to EUR rather than throwing, mirroring how other campaign
 * fields coerce invalid input to a safe default.
 */
export function normalizeCurrency(
  input: unknown,
  fallback: SupportedCurrency = 'EUR',
): SupportedCurrency {
  const code = String(input ?? '').trim().toUpperCase();
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code)
    ? (code as SupportedCurrency)
    : fallback;
}

/**
 * Fully refund a donation's payment. Only valid PRE-release (while the funds
 * still sit in the platform balance); post-release requires reversing the
 * transfer instead. Pass a stable idempotencyKey so a retry never double-refunds.
 */
export async function refundPayment(
  paymentIntentId: string,
  idempotencyKey?: string,
): Promise<Stripe.Refund> {
  return stripe().refunds.create(
    { payment_intent: paymentIntentId },
    idempotencyKey ? { idempotencyKey } : undefined,
  );
}

/** Convert a major-unit amount (e.g. 25.00) to minor units (2500). */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

/** Convert minor units (2500) to major units (25.00). */
export function toMajorUnits(amountMinor: number): number {
  return amountMinor / 100;
}
