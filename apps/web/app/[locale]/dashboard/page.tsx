import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Campaign } from '@laal/types';
import { Link } from '@/i18n/navigation';
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server';
import {
  Badge,
  Button,
  Card,
  Container,
  Progress,
  formatMoney,
  statusTone,
} from '@/components/ui';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  return { title: t('meta.title') };
}

function isEditable(status: Campaign['status']): boolean {
  return status === 'draft' || status === 'pending_review';
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('campaigns')
    .select('*')
    .eq('organizer_id', user.id)
    .order('created_at', { ascending: false });

  const campaigns: Campaign[] = data ?? [];

  return (
    <main className="section">
      <Container narrow>
        <div className="row-between wrap" style={{ marginBottom: '2rem' }}>
          <div className="stack" style={{ gap: '0.25rem' }}>
            <span className="eyebrow">{t('eyebrow')}</span>
            <h1 style={{ margin: 0 }}>{t('heading')}</h1>
          </div>
          <Button href="/start" variant="primary">
            {t('startFundraiser')}
          </Button>
        </div>

        {campaigns.length === 0 ? (
          <Card large>
            <div className="stack center">
              <h3 style={{ margin: 0 }}>{t('empty.title')}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {t('empty.body')}
              </p>
              <div>
                <Button href="/start" variant="primary">
                  {t('empty.cta')}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="stack">
            {campaigns.map((c) => {
              const pct =
                c.goal_amount > 0
                  ? (c.amount_raised / c.goal_amount) * 100
                  : 0;
              return (
                <Card key={c.id}>
                  <div className="stack">
                    <div className="row-between wrap" style={{ gap: '0.75rem' }}>
                      <h3 style={{ margin: 0 }}>{c.title}</h3>
                      <Badge tone={statusTone(c.status)}>
                        {t(`status.${c.status}`)}
                      </Badge>
                    </div>

                    <p className="muted small" style={{ margin: 0 }}>
                      {t('inMemoryOf', { name: c.deceased_name })}
                    </p>

                    <Progress value={pct} />
                    <p className="small" style={{ margin: 0 }}>
                      <strong>
                        {formatMoney(c.amount_raised, c.currency, locale)}
                      </strong>{' '}
                      {t('raisedOf', {
                        amount: formatMoney(c.goal_amount, c.currency, locale),
                      })}
                    </p>

                    <div className="row wrap">
                      {isEditable(c.status) ? (
                        <Button
                          href={`/dashboard/campaigns/${c.id}/edit`}
                          variant="primary"
                          size="sm"
                        >
                          {t('edit')}
                        </Button>
                      ) : (
                        <Button
                          href={`/campaigns/${c.slug}`}
                          variant="ghost"
                          size="sm"
                        >
                          {t('view')}
                        </Button>
                      )}
                      <Button
                        href={`/dashboard/campaigns/${c.id}/documents`}
                        variant="ghost"
                        size="sm"
                      >
                        {t('documents')}
                      </Button>
                      {/* Offered at every status — organizers can write before
                          the fundraiser is live; the hint explains when it
                          becomes visible. */}
                      <Button
                        href={`/dashboard/campaigns/${c.id}/updates`}
                        variant="ghost"
                        size="sm"
                      >
                        {t('updates')}
                      </Button>
                    </div>
                    <p className="hint" style={{ margin: 0 }}>
                      {t('updatesHint')}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Container>
    </main>
  );
}
