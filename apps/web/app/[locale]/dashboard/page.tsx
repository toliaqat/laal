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
import { MemorialPhoto } from '@/components/memorial-photo';

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
  const tc = await getTranslations('common');
  const ts = await getTranslations('start');

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
                    {/* Their loved one's photo (or initials) at the inline
                        start — the same face supporters see on the browse card,
                        so the organizer recognises what the public sees. */}
                    <div
                      className="row"
                      style={{ alignItems: 'flex-start', gap: '1rem' }}
                    >
                      <MemorialPhoto
                        size="sm"
                        name={c.deceased_name}
                        photoUrl={c.cover_image_url}
                        alt={ts('cover.photoOfAlt', { name: c.deceased_name })}
                      />
                      <div
                        className="stack"
                        style={{ gap: '0.35rem', flex: 1, minWidth: 0 }}
                      >
                        <div
                          className="row-between wrap"
                          style={{ gap: '0.75rem' }}
                        >
                          <h3 className="ugc" style={{ margin: 0 }}>
                            {c.title}
                          </h3>
                          <Badge tone={statusTone(c.status)}>
                            {t(`status.${c.status}`)}
                          </Badge>
                        </div>

                        {/* The remembered person's name is user-generated. */}
                        <p className="muted small ugc" style={{ margin: 0 }}>
                          {t('inMemoryOf', { name: c.deceased_name })}
                        </p>
                      </div>
                    </div>

                    <Progress value={pct} label={tc('progressLabel')} />
                    <p className="small" style={{ margin: 0 }}>
                      <strong className="num">
                        {formatMoney(c.amount_raised, c.currency, locale)}
                      </strong>{' '}
                      {/* `<n>` carries `.num` so the goal reads €5,000 (not
                          5,000€) inside Urdu copy. */}
                      {t.rich('raisedOf', {
                        amount: formatMoney(c.goal_amount, c.currency, locale),
                        n: (chunks) => <bdi className="num">{chunks}</bdi>,
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
