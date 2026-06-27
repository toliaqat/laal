import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container, Card, Button } from '@/components/ui';

type Params = { slug: string; locale: string };
type Search = { session_id?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'campaigns' });
  return {
    title: t('thankYou.metaTitle'),
    robots: { index: false },
  };
}

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('campaigns');
  // session_id is present when arriving from Stripe Checkout; we don't need it
  // to render, but await it so Next 15's async searchParams contract is met.
  await searchParams;

  return (
    <main className="section">
      <Container narrow>
        <Card large>
          <div className="stack center">
            <div
              aria-hidden
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--accent)',
                color: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
              }}
            >
              ♥
            </div>
            <h1 style={{ margin: 0 }}>{t('thankYou.title')}</h1>
            <p className="muted" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
              {t('thankYou.body1')}
            </p>
            <p className="muted" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
              {t('thankYou.body2')}
            </p>
            <div className="center" style={{ marginTop: '0.5rem' }}>
              <Button href={`/campaigns/${slug}`} variant="primary">
                {t('thankYou.returnCta')}
              </Button>
            </div>
          </div>
        </Card>
      </Container>
    </main>
  );
}
