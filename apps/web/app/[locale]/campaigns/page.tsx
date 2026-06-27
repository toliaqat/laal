import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Campaign } from '@laal/types';
import { Link } from '@/i18n/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { Container, Card, Button, Progress, formatMoney } from '@/components/ui';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'campaigns' });
  return { title: t('list.metaTitle'), description: t('list.metaDescription') };
}

export default async function CampaignsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('campaigns');

  let campaigns: Campaign[] = [];
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .order('published_at', { ascending: false });
    campaigns = (data as Campaign[] | null) ?? [];
  } catch {
    campaigns = [];
  }

  return (
    <main className="section">
      <Container>
        <div className="stack" style={{ gap: '0.25rem', marginBottom: '2rem' }}>
          <span className="eyebrow">{t('list.eyebrow')}</span>
          <h1 style={{ margin: 0 }}>{t('list.title')}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t('list.subtitle')}
          </p>
        </div>

        {campaigns.length === 0 ? (
          <Card large>
            <div className="stack center">
              <p className="muted" style={{ margin: 0 }}>
                {t('list.emptyBody')}
              </p>
              <div className="center">
                <Button href="/start" variant="primary" size="sm">
                  {t('list.emptyCta')}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cards">
            {campaigns.map((c) => {
              const pct = c.goal_amount
                ? (c.amount_raised / c.goal_amount) * 100
                : 0;
              return (
                <Link
                  key={c.id}
                  href={`/campaigns/${c.slug}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <Card hover>
                    <div className="stack" style={{ gap: '0.75rem' }}>
                      <h3 style={{ margin: 0 }}>{c.title}</h3>
                      <p className="small muted" style={{ margin: 0 }}>
                        {t('list.inMemoryOf', { name: c.deceased_name })}
                      </p>
                      <Progress value={pct} />
                      <p className="small" style={{ margin: 0 }}>
                        <strong>
                          {formatMoney(c.amount_raised, c.currency, locale)}
                        </strong>{' '}
                        <span className="muted">
                          {t('list.ofGoal', {
                            amount: formatMoney(c.goal_amount, c.currency, locale),
                          })}
                        </span>
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </Container>
    </main>
  );
}
