import { createServerSupabase } from '@/lib/supabase/server';
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
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
        Start a campaign
      </h1>
      <p style={{ color: '#555', marginTop: 0 }}>
        Create a dignified memorial fund. We review every campaign before it
        goes live.
      </p>
      <StartForm orgs={orgs} />
    </main>
  );
}
