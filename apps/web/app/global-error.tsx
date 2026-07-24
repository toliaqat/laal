'use client';

import { dirFor } from '@laal/i18n';
import { webDefaultLocale } from '@/i18n/routing';

/**
 * Last-resort error boundary. Fires when the [locale] layout itself fails, so
 * it must render its own <html>/<body> and cannot rely on next-intl — copy is
 * hard-coded Urdu-first (the site default) with an English line beneath,
 * mirroring not-found.tsx.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang={webDefaultLocale} dir={dirFor(webDefaultLocale)}>
      <body
        style={{
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          background: '#f3eee4',
          color: '#2a2620',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
        }}
      >
        <main style={{ textAlign: 'center', padding: '2rem', maxWidth: 480 }}>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>
            کچھ غلط ہو گیا
          </h1>
          <p style={{ color: '#837a6b', marginBottom: '0.25rem' }}>
            معذرت — ایک غیر متوقع خرابی پیش آئی۔ براہِ کرم دوبارہ کوشش کریں۔
          </p>
          <p style={{ color: '#837a6b', marginTop: 0 }}>
            <span dir="ltr">Something went wrong — please try again.</span>
          </p>
          <button
            onClick={reset}
            style={{
              background: '#9c6b4a',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '0.6rem 1.2rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            دوبارہ کوشش کریں / Try again
          </button>
          {error.digest ? (
            <p style={{ color: '#837a6b', fontSize: '0.8rem', marginTop: '1rem' }}>
              <span dir="ltr">Ref: {error.digest}</span>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
