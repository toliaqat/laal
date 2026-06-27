import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { Container } from '@/components/ui';
import { StartForm } from './start-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'start' });
  return { title: t('meta.title') };
}

type OrgOption = { id: string; name: string };

export default async function StartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('start');

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('status', 'verified')
    .eq('can_be_beneficiary', true)
    .order('name');

  const orgs: OrgOption[] = data ?? [];

  return (
    <main className="section">
      <Container narrow>
        <div className="stack" style={{ gap: '0.35rem', marginBottom: '2rem' }}>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1 style={{ margin: 0 }}>{t('title')}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t('lead')}
          </p>
        </div>
        <StartForm orgs={orgs} />
      </Container>
    </main>
  );
}
