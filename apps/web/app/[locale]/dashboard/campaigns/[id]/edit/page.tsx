import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Beneficiary, Campaign } from '@laal/types';
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server';
import { Container } from '@/components/ui';
import { EditForm } from './edit-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  return { title: t('editPage.meta.title') };
}

type OrgOption = { id: string; name: string };

const EDITABLE_STATUSES: Campaign['status'][] = ['draft', 'pending_review'];

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const supabase = await createServerSupabase();

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle<Campaign>();

  // Authorization: must be the owner and the campaign must be editable.
  if (
    !campaign ||
    campaign.organizer_id !== user!.id ||
    !EDITABLE_STATUSES.includes(campaign.status)
  ) {
    redirect('/dashboard');
  }

  const { data: beneficiary } = await supabase
    .from('beneficiaries')
    .select('*')
    .eq('campaign_id', campaign.id)
    .eq('is_active', true)
    .maybeSingle<Beneficiary>();

  const { data: orgData } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('status', 'verified')
    .eq('can_be_beneficiary', true)
    .order('name');

  const orgs: OrgOption[] = orgData ?? [];

  return (
    <main className="section">
      <Container narrow>
        <div className="stack" style={{ gap: '0.35rem', marginBottom: '2rem' }}>
          <span className="eyebrow">{t('editPage.eyebrow')}</span>
          <h1 style={{ margin: 0 }}>{campaign.title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t('inMemoryOf', { name: campaign.deceased_name })}
          </p>
        </div>
        <EditForm campaign={campaign} beneficiary={beneficiary} orgs={orgs} />
      </Container>
    </main>
  );
}
