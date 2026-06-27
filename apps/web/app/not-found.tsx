import { dirFor } from '@laal/i18n';
import { webDefaultLocale } from '@/i18n/routing';

/**
 * Global not-found boundary. The app's real root layout lives under
 * `[locale]/`, so a request that resolves no locale (or a `notFound()` raised
 * outside the locale tree) renders here — and must supply its own <html>.
 * Uses the website's default locale (Urdu).
 */
export default function NotFound() {
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
        <main style={{ textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>404</h1>
          <p style={{ color: '#837a6b' }}>یہ صفحہ نہیں مل سکا۔</p>
          <a href={`/${webDefaultLocale}`} style={{ color: '#9c6b4a', fontWeight: 600 }}>
            ہوم پیج پر واپس جائیں
          </a>
        </main>
      </body>
    </html>
  );
}
