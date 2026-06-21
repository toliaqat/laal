import { createAdminSupabase } from '@/lib/supabase/server';
import type { CampaignStatus } from '@ashfaat/types';

const STATUS_ORDER: CampaignStatus[] = [
  'draft',
  'pending_review',
  'active',
  'paused',
  'completed',
  'closed',
  'rejected',
];

export default async function AdminOverviewPage() {
  const supabase = createAdminSupabase();

  const [{ data: campaigns }, { data: pendingVerifs }] = await Promise.all([
    supabase.from('campaigns').select('status, amount_raised, currency'),
    supabase
      .from('verifications')
      .select('id')
      .in('status', ['pending', 'submitted']),
  ]);

  const counts: Record<string, number> = {};
  let totalRaised = 0;
  let currency = '';
  for (const c of campaigns ?? []) {
    counts[c.status] = (counts[c.status] ?? 0) + 1;
    totalRaised += Number(c.amount_raised ?? 0);
    if (!currency && c.currency) currency = c.currency;
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>Overview</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <Card label="Pending verifications" value={String(pendingVerifs?.length ?? 0)} />
        <Card
          label="Total raised"
          value={`${currency || ''} ${totalRaised.toFixed(2)}`.trim()}
        />
        <Card
          label="Total campaigns"
          value={String((campaigns ?? []).length)}
        />
      </div>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
        Campaigns by status
      </h2>
      <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 420 }}>
        <tbody>
          {STATUS_ORDER.map((status) => (
            <tr key={status} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '0.5rem 0.5rem 0.5rem 0' }}>{status}</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 600 }}>
                {counts[status] ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid #eee',
        borderRadius: 10,
        padding: '1.25rem',
        background: '#fafafa',
      }}
    >
      <div style={{ color: '#888', fontSize: '0.8rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>
        {value}
      </div>
    </div>
  );
}
