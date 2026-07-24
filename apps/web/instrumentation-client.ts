import * as Sentry from '@sentry/nextjs';

/**
 * Browser-side Sentry init (errors only). The DSN is public by design; it is
 * inlined at build time from NEXT_PUBLIC_SENTRY_DSN (fly.toml build args).
 * Without it the SDK stays disabled.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
