import Link from 'next/link';
import type { Campaign } from '@ashfaat/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { CampaignCard } from '@/components/campaign-card';

export const metadata = {
  title: 'Campaigns — Ashfaat',
  description: 'Verified memorial funds you can contribute to.',
};

export default async function CampaignsPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'active')
    .order('published_at', { ascending: false });

  const campaigns: Campaign[] = data ?? [];

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Campaigns</h1>
      <p style={{ color: '#555', marginTop: 0 }}>
        Verified memorial funds you can contribute to.
      </p>

      {campaigns.length === 0 ? (
        <div
          style={{
            marginTop: '2.5rem',
            padding: '2rem',
            border: '1px dashed #d4d4d4',
            borderRadius: 12,
            textAlign: 'center',
            color: '#888',
          }}
        >
          <p style={{ margin: 0 }}>No active campaigns yet.</p>
          <p style={{ margin: '0.5rem 0 0' }}>
            <Link href="/start">Start one</Link>
          </p>
        </div>
      ) : (
        <div
          style={{
            marginTop: '2rem',
            display: 'grid',
            gap: '1rem',
          }}
        >
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </main>
  );
}
