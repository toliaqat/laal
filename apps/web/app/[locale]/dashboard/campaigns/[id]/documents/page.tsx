import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server';
import { Container, Card, Button, Badge } from '@/components/ui';
import { uploadDocument, deleteDocument } from './actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  return { title: t('documentsPage.meta.title') };
}

const DOC_TYPES = [
  'death_certificate',
  'passport',
  'national_id',
  'noc',
  'obituary',
  'relationship_proof',
  'other',
] as const;

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createServerSupabase();
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, title, organizer_id')
    .eq('id', id)
    .maybeSingle();
  if (!campaign || campaign.organizer_id !== user.id) redirect('/dashboard');

  const { data: documents } = await supabase
    .from('documents')
    .select('id, type, status, created_at')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false });

  return (
    <Container narrow style={{ paddingTop: '2.5rem', paddingBottom: '3rem' }}>
      <p className="eyebrow">{t('documentsPage.eyebrow')}</p>
      <h1 style={{ marginTop: '0.25rem' }}>{campaign.title}</h1>
      <p className="muted">{t('documentsPage.intro')}</p>

      <Card large style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>{t('documentsPage.uploadTitle')}</h3>
        <form action={uploadDocument} className="stack" style={{ gap: '1rem' }}>
          <input type="hidden" name="campaignId" value={id} />
          <div className="field">
            <label className="label">{t('documentsPage.typeLabel')}</label>
            <select name="type" className="select" defaultValue="death_certificate">
              {DOC_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`docType.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">{t('documentsPage.fileLabel')}</label>
            <input
              name="file"
              type="file"
              className="input"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              required
            />
            <span className="hint">{t('documentsPage.fileHint')}</span>
          </div>
          <Button type="submit" variant="primary">
            {t('documentsPage.uploadButton')}
          </Button>
        </form>
      </Card>

      <h3 style={{ marginTop: '2rem' }}>{t('documentsPage.uploadedHeading')}</h3>
      {!documents || documents.length === 0 ? (
        <p className="muted">{t('documentsPage.empty')}</p>
      ) : (
        <div className="stack" style={{ gap: '0.6rem' }}>
          {documents.map((d) => (
            <Card key={d.id}>
              <div className="row-between wrap">
                <span>
                  {t.has(`docType.${d.type}`) ? t(`docType.${d.type}`) : d.type}
                </span>
                <span className="row wrap" style={{ gap: '0.75rem' }}>
                  <Badge
                    tone={d.status === 'approved' ? 'success' : 'warning'}
                  >
                    {t.has(`docStatus.${d.status}`)
                      ? t(`docStatus.${d.status}`)
                      : d.status}
                  </Badge>
                  <form action={deleteDocument}>
                    <input type="hidden" name="campaignId" value={id} />
                    <input type="hidden" name="documentId" value={d.id} />
                    <button type="submit" className="btn btn-ghost btn-sm">
                      {t('documentsPage.remove')}
                    </button>
                  </form>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p style={{ marginTop: '1.5rem' }}>
        <Link href="/dashboard" className="nav-link">
          {t('documentsPage.backToDashboard')}
        </Link>
      </p>
    </Container>
  );
}
