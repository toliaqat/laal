import * as Sentry from '@sentry/nextjs';

/**
 * Server-side Sentry init (errors only — no tracing). Runs once per server
 * start via Next's instrumentation hook. Without SENTRY_DSN set (local dev,
 * CI) the SDK stays disabled and everything degrades to console logging.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      enabled: Boolean(process.env.SENTRY_DSN),
      tracesSampleRate: 0,
    });

    // Fly scale-to-zero sends SIGINT and kills shortly after — flush pending
    // events so the last error before an autostop isn't lost.
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.on(signal, () => {
        void Sentry.flush(2000);
      });
    }
  }
}

/** Captures every server request error (server components, actions, routes). */
export const onRequestError = Sentry.captureRequestError;
