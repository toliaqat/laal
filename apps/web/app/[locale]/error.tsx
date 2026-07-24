'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, Container } from '@/components/ui';

/**
 * Locale-segment error boundary: catches anything a page or server component
 * throws that isn't a recoverable ActionState (those render inline in forms).
 * Lives inside the [locale] layout, so translations and the site chrome's
 * html/body are available. The digest is shown as a support reference — it's
 * what appears alongside the server-side log entry.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors.boundary');

  useEffect(() => {
    console.error('[error-boundary]', error);
  }, [error]);

  return (
    <Container narrow style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
      <Card large>
        <div className="stack">
          <h1 style={{ margin: 0 }}>{t('title')}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t('body')}
          </p>
          <div className="row wrap">
            <Button onClick={reset}>{t('retry')}</Button>
            <Button href="/" variant="ghost">
              {t('home')}
            </Button>
          </div>
          {error.digest ? (
            <p className="small muted" style={{ margin: 0 }}>
              {t('reference', { digest: error.digest })}
            </p>
          ) : null}
        </div>
      </Card>
    </Container>
  );
}
