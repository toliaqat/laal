import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/server';
import { approveCampaignForm, rejectCampaignForm } from '@/app/admin/actions';

export default async function ReviewQueuePage() {
  const supabase = createAdminSupabase();

  const [{ data: pending }, { data: active }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, title, slug, amount_raised, currency, created_at')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true }),
    supabase
      .from('campaigns')
      .select('id, title, slug, amount_raised, currency, published_at')
      .eq('status', 'active')
      .order('published_at', { ascending: false }),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>Review queue</h1>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
          Pending review ({pending?.length ?? 0})
        </h2>
        {(pending ?? []).length === 0 ? (
          <p style={{ color: '#888' }}>Nothing awaiting review.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(pending ?? []).map((c) => (
              <li
                key={c.id}
                style={{
                  border: '1px solid #eee',
                  borderRadius: 10,
                  padding: '1rem',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div style={{ flex: 1 }}>
                  <Link
                    href={`/admin/campaigns/${c.id}`}
                    style={{ fontWeight: 600, color: '#111' }}
                  >
                    {c.title}
                  </Link>
                  <div style={{ color: '#888', fontSize: '0.85rem' }}>
                    {c.currency} {Number(c.amount_raised ?? 0).toFixed(2)} raised
                  </div>
                </div>
                <form action={approveCampaignForm.bind(null, c.id)}>
                  <button type="submit" style={btn('#16794a')}>
                    Approve
                  </button>
                </form>
                <form action={rejectCampaignForm.bind(null, c.id)}>
                  <button type="submit" style={btn('#b3261e')}>
                    Reject
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
          Active ({active?.length ?? 0})
        </h2>
        {(active ?? []).length === 0 ? (
          <p style={{ color: '#888' }}>No active campaigns.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(active ?? []).map((c) => (
              <li
                key={c.id}
                style={{
                  borderBottom: '1px solid #f0f0f0',
                  padding: '0.75rem 0',
                  display: 'flex',
                  gap: '1rem',
                }}
              >
                <Link
                  href={`/admin/campaigns/${c.id}`}
                  style={{ flex: 1, color: '#111' }}
                >
                  {c.title}
                </Link>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>
                  {c.currency} {Number(c.amount_raised ?? 0).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '0.5rem 0.9rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
  };
}
