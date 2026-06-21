/**
 * Centralised env access. Values are read lazily so a build without secrets
 * (e.g. CI typecheck) does not crash at import time — only at call time.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

// Public (safe in client bundles)
export const SUPABASE_URL = () => required('NEXT_PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON_KEY = () => required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
export const STRIPE_PUBLISHABLE_KEY = () =>
  required('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');

// Server-only
export const SUPABASE_SERVICE_ROLE_KEY = () =>
  required('SUPABASE_SERVICE_ROLE_KEY');
export const STRIPE_SECRET_KEY = () => required('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET = () => required('STRIPE_WEBHOOK_SECRET');
export const RESEND_API_KEY = () => required('RESEND_API_KEY');

// Misc
export const APP_URL = () =>
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
export const EMAIL_FROM = () =>
  process.env.EMAIL_FROM ?? 'Ashfaat <noreply@ashfaat.app>';
