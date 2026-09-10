import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Button, Card, Container } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notFound');
  // Keep 404s out of the index — a stale shared link shouldn't become a result.
  return { title: t('metaTitle'), robots: { index: false, follow: true } };
}

/**
 * Locale-segment 404. Lives inside the [locale] layout, so it gets the site
 * chrome, the right font and `dir`, and real translations — unlike the global
 * `app/not-found.tsx` boundary, which must ship its own bare <html> and can
 * only guess a language (it showed hard-coded Urdu to /en visitors).
 *
 * Anything that calls `notFound()` under a locale — a fundraiser slug that no
 * longer exists, a mistyped path — renders here. A shared link that has gone
 * stale is a common way people meet Laal, so this page offers a way onward
 * rather than a dead end.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations();

  return (
    <main className="section">
      <Container narrow>
        <Card large>
          <div className="stack">
            <span className="eyebrow">404</span>
            <h1 style={{ margin: 0 }}>{t('notFound.title')}</h1>
            <p className="muted" style={{ margin: 0 }}>
              {t('notFound.body')}
            </p>
            <div className="row wrap">
              <Button href="/campaigns">{t('notFound.cta')}</Button>
              <Button href="/" variant="ghost">
                {t('notFound.home')}
              </Button>
            </div>
          </div>
        </Card>
      </Container>
    </main>
  );
}
