import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/server';
import { approveCampaignForm, rejectCampaignForm } from '@/app/admin/actions';
import { Badge, formatMoney, statusTone } from '@/components/ui';

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

  const pendingRows = pending ?? [];
  const activeRows = active ?? [];

  return (
    <div className="stack">
      <div className="stack" style={{ gap: '0.25rem' }}>
        <span className="eyebrow">Admin</span>
        <h1>Review queue</h1>
        <p className="muted">Approve or reject campaigns awaiting review.</p>
      </div>

      <section className="stack" style={{ gap: '0.75rem' }}>
        <h2>Pending review ({pendingRows.length})</h2>
        {pendingRows.length === 0 ? (
          <p className="muted">Nothing awaiting review.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th style={{ textAlign: 'right' }}>Raised</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingRows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/campaigns/${c.id}`}>{c.title}</Link>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatMoney(
                      Number(c.amount_raised ?? 0),
                      c.currency || 'EUR',
                    )}
                  </td>
                  <td>
                    <div
                      className="row wrap"
                      style={{ gap: '0.4rem', justifyContent: 'flex-end' }}
                    >
                      <form action={approveCampaignForm.bind(null, c.id)}>
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                        >
                          Approve
                        </button>
                      </form>
                      <form action={rejectCampaignForm.bind(null, c.id)}>
                        <button
                          type="submit"
                          className="btn btn-danger btn-sm"
                        >
                          Reject
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="stack" style={{ gap: '0.75rem' }}>
        <h2>Active ({activeRows.length})</h2>
        {activeRows.length === 0 ? (
          <p className="muted">No active campaigns.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Raised</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/campaigns/${c.id}`}>{c.title}</Link>
                  </td>
                  <td>
                    <Badge tone={statusTone('active')}>active</Badge>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatMoney(
                      Number(c.amount_raised ?? 0),
                      c.currency || 'EUR',
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
