import { Link } from '@/i18n/navigation';
import { ActionForm, SubmitButton } from '@/components/form';
import { createAdminSupabase } from '@/lib/supabase/server';
import { approveCampaign, rejectCampaign } from '@/app/[locale]/admin/actions';
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
        <h1>Fundraiser review queue</h1>
        <p className="muted">Review the fundraisers families have shared before they go live.</p>
      </div>

      <section className="stack" style={{ gap: '0.75rem' }}>
        <h2>Awaiting review ({pendingRows.length})</h2>
        {pendingRows.length === 0 ? (
          <p className="muted">No fundraisers awaiting review.</p>
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
                      <ActionForm action={approveCampaign.bind(null, c.id)} showDetail>
                        <SubmitButton size="sm">Approve fundraiser</SubmitButton>
                      </ActionForm>
                      <ActionForm action={rejectCampaign.bind(null, c.id)} showDetail>
                        <SubmitButton variant="danger" size="sm">Reject</SubmitButton>
                      </ActionForm>
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
