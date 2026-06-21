import 'server-only';

import Stripe from 'stripe';
import { APP_URL, STRIPE_SECRET_KEY } from '@/lib/env';

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

/** Hosted onboarding link where the beneficiary completes KYC + bank details. */
export async function createOnboardingLink(accountId: string): Promise<string> {
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: `${APP_URL()}/admin/onboarding/refresh?account=${accountId}`,
    return_url: `${APP_URL()}/admin/onboarding/return?account=${accountId}`,
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
 */
export async function createDonationCheckout(params: {
  campaignId: string;
  campaignSlug: string;
  campaignTitle: string;
  amountMinor: number; // smallest currency unit (e.g. cents)
  currency: string;
  donorEmail?: string;
  isAnonymous?: boolean;
  message?: string;
}): Promise<{ id: string; url: string | null }> {
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer_email: params.donorEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: params.currency.toLowerCase(),
          unit_amount: params.amountMinor,
          product_data: {
            name: `Donation — ${params.campaignTitle}`,
          },
        },
      },
    ],
    metadata: {
      campaign_id: params.campaignId,
      is_anonymous: String(Boolean(params.isAnonymous)),
      message: params.message?.slice(0, 450) ?? '',
    },
    payment_intent_data: {
      metadata: { campaign_id: params.campaignId },
    },
    success_url: `${APP_URL()}/campaigns/${params.campaignSlug}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL()}/campaigns/${params.campaignSlug}`,
  });
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

/** Convert a major-unit amount (e.g. 25.00) to minor units (2500). */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

/** Convert minor units (2500) to major units (25.00). */
export function toMajorUnits(amountMinor: number): number {
  return amountMinor / 100;
}
