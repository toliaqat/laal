import { createServerSupabase } from '@/lib/supabase/server';
import { Container } from '@/components/ui';
import { StartForm } from './start-form';

export const metadata = {
  title: 'Start a campaign — Ashfaat',
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
          <span className="eyebrow">New campaign</span>
          <h1 style={{ margin: 0 }}>Start a campaign</h1>
          <p className="muted" style={{ margin: 0 }}>
            Create a dignified memorial fund. We review every campaign before it
            goes live.
          </p>
        </div>
        <StartForm orgs={orgs} />
      </Container>
    </main>
  );
}
