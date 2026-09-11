/**
 * Centralised env access. Values are read lazily so a build without secrets
 * (e.g. CI typecheck) does not crash at import time — only at call time.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

// Public (safe in client bundles).
// IMPORTANT: these MUST be referenced as static `process.env.NEXT_PUBLIC_*`
// literals so Next.js inlines them into the browser bundle. A dynamic lookup
// (e.g. `process.env[name]`) is NOT inlined and is `undefined` on the client.
function requiredValue(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
export const SUPABASE_URL = () =>
  requiredValue('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = () =>
  requiredValue(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
export const STRIPE_PUBLISHABLE_KEY = () =>
  requiredValue(
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );

// Server-only
export const SUPABASE_SERVICE_ROLE_KEY = () =>
  required('SUPABASE_SERVICE_ROLE_KEY');
export const STRIPE_SECRET_KEY = () => required('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET = () => required('STRIPE_WEBHOOK_SECRET');
export const RESEND_API_KEY = () => required('RESEND_API_KEY');

// Cloudflare R2 (S3-compatible object storage) — server-only.
export const R2_ACCOUNT_ID = () => required('R2_ACCOUNT_ID');
export const R2_ACCESS_KEY_ID = () => required('R2_ACCESS_KEY_ID');
export const R2_SECRET_ACCESS_KEY = () => required('R2_SECRET_ACCESS_KEY');
// Private bucket: verification documents (presigned reads only).
export const R2_BUCKET = () => required('R2_BUCKET');
// Public bucket: campaign cover images (world-readable via R2_PUBLIC_BASE_URL).
// Kept separate from the private bucket so a misconfiguration can never make a
// passport scan public, nor force a cover image behind signed URLs.
export const R2_PUBLIC_BUCKET = () => required('R2_PUBLIC_BUCKET');
// The public origin that serves the public bucket (a Cloudflare custom domain
// or the bucket's r2.dev URL), e.g. https://img.laal.app — no trailing slash.
export const R2_PUBLIC_BASE_URL = () =>
  required('R2_PUBLIC_BASE_URL').replace(/\/+$/, '');
// The same origin, or null when unset — for surfaces that can degrade
// gracefully without it (the landing-page demo video) instead of throwing.
export const R2_PUBLIC_BASE_URL_IF_SET = () =>
  process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '') || null;

// Misc
// Trailing slash stripped (like R2_PUBLIC_BASE_URL): APP_URL() is always joined
// with leading-slash paths (`${APP_URL()}/campaigns/...`, OAuth `${base}${next}`,
// Stripe success/cancel + email links), so a trailing slash in the env var would
// produce malformed `//` URLs and can break the OAuth redirect origin match.
export const APP_URL = () =>
  (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
export const EMAIL_FROM = () =>
  process.env.EMAIL_FROM ?? 'Laal <noreply@laal.app>';
