import { createServerSupabase } from '@/lib/supabase/server';
import { Container } from '@/components/ui';
import { StartForm } from './start-form';

export const metadata = {
  title: 'Share a story — Laal',
};

type OrgOption = { id: string; name: string };

export default async function StartPage() {
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
          <span className="eyebrow">New story</span>
          <h1 style={{ margin: 0 }}>Share a story</h1>
          <p className="muted" style={{ margin: 0 }}>
            Tell us about your loved one and the family who needs support. We
            carefully review every story before it goes live, with care for
            their dignity.
          </p>
        </div>
        <StartForm orgs={orgs} />
      </Container>
    </main>
  );
}
