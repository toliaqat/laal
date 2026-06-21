import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/server';
import { Badge, formatMoney, statusTone } from '@/components/ui';
import {
  closeCampaignForm,
  pauseCampaignForm,
  resumeCampaignForm,
  recomputeAmountRaisedForm,
} from './actions';

export default async function AdminHousekeepingPage() {
  const supabase = createAdminSupabase();

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, title, status, amount_raised, currency, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = campaigns ?? [];

  return (
    <div className="stack">
      <div className="stack" style={{ gap: '0.25rem' }}>
        <span className="eyebrow">Admin</span>
        <h1>Housekeeping</h1>
        <p className="muted">
          Maintenance tools for recent campaigns. Recompute re-sums succeeded
          donations into the stored raised total.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="muted">No campaigns found.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Raised</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/campaigns/${c.id}`}>{c.title}</Link>
                </td>
                <td>
                  <Badge tone={statusTone(c.status)}>
                    {c.status.replace(/_/g, ' ')}
                  </Badge>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {formatMoney(
                    Number(c.amount_raised ?? 0),
                    c.currency || 'EUR',
                  )}
                </td>
                <td>
                  <div className="row wrap" style={{ gap: '0.4rem' }}>
                    {c.status === 'active' && (
                      <form action={pauseCampaignForm.bind(null, c.id)}>
                        <button type="submit" className="btn btn-ghost btn-sm">
                          Pause
                        </button>
                      </form>
                    )}
                    {c.status === 'paused' && (
                      <form action={resumeCampaignForm.bind(null, c.id)}>
                        <button type="submit" className="btn btn-ghost btn-sm">
                          Resume
                        </button>
                      </form>
                    )}
                    <form action={recomputeAmountRaisedForm.bind(null, c.id)}>
                      <button type="submit" className="btn btn-ghost btn-sm">
                        Recompute
                      </button>
                    </form>
                    {c.status !== 'closed' && (
                      <form action={closeCampaignForm.bind(null, c.id)}>
                        <button type="submit" className="btn btn-danger btn-sm">
                          Close
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
