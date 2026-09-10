import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import type { CampaignUpdate } from '@laal/types';
import { Link } from '@/i18n/navigation';
import { Alert, Card, Container } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/form';
import { requireOwnedCampaign, isPubliclyVisible } from '@/lib/campaign-auth';
import { deleteUpdate } from './actions';
import { UpdateForm } from './update-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  return { title: t('updatesPage.meta.title') };
}

export default async function UpdatesPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');
  const format = await getFormatter();

  const { supabase, campaign } = await requireOwnedCampaign(id);

  const { data } = await supabase
    .from('campaign_updates')
    .select('id, campaign_id, author_id, body, created_at')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false });
  const updates: CampaignUpdate[] = data ?? [];

  const live = isPubliclyVisible(campaign.status);

  return (
    <Container narrow style={{ paddingTop: '2.5rem', paddingBottom: '3rem' }}>
      <p className="eyebrow">{t('updatesPage.eyebrow')}</p>
      <h1 style={{ marginTop: '0.25rem' }}>{campaign.title}</h1>
      <p className="muted">{t('updatesPage.intro')}</p>

      {live ? (
        <p className="small">
          <Link href={`/campaigns/${campaign.slug}`} className="nav-link">
            {t('updatesPage.viewPublic')}
          </Link>
        </p>
      ) : (
        <Alert tone="info">{t('updatesPage.notLive')}</Alert>
      )}

      <Card large style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>{t('updatesPage.postTitle')}</h3>
        <UpdateForm campaignId={id} />
      </Card>

      <h3 style={{ marginTop: '2rem' }}>{t('updatesPage.postedHeading')}</h3>
      {updates.length === 0 ? (
        <p className="muted">{t('updatesPage.empty')}</p>
      ) : (
        <div className="stack" style={{ gap: '0.6rem' }}>
          {updates.map((u) => (
            <Card key={u.id}>
              <div className="stack" style={{ gap: '0.5rem' }}>
                <div className="row-between wrap">
                  <time
                    className="small muted"
                    dateTime={u.created_at}
                    suppressHydrationWarning
                  >
                    {format.dateTime(new Date(u.created_at), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                  <ActionForm action={deleteUpdate}>
                    <input type="hidden" name="campaignId" value={id} />
                    <input type="hidden" name="updateId" value={u.id} />
                    <SubmitButton variant="ghost" size="sm">
                      {t('updatesPage.remove')}
                    </SubmitButton>
                  </ActionForm>
                </div>
                {/* Plain text only — never dangerouslySetInnerHTML. */}
                <p
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    unicodeBidi: 'plaintext',
                  }}
                >
                  {u.body}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p style={{ marginTop: '1.5rem' }}>
        <Link href="/dashboard" className="nav-link">
          {t('updatesPage.backToDashboard')}
        </Link>
      </p>
    </Container>
  );
}
