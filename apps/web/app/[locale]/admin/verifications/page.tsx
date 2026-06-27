import { Link } from '@/i18n/navigation';
import { createAdminSupabase } from '@/lib/supabase/server';
import { setVerificationForm } from '@/app/[locale]/admin/actions';
import { Badge, statusTone } from '@/components/ui';

type CampaignRef = { id: string; title: string } | null;

export default async function VerificationQueuePage() {
  const supabase = createAdminSupabase();

  const { data } = await supabase
    .from('verifications')
    .select(
      'id, type, status, verifier_type, notes, created_at, campaign_id, campaigns(id, title)',
    )
    .in('status', ['pending', 'submitted'])
    .order('created_at', { ascending: true });

  const rows = (data ?? []).map((v) => ({
    ...v,
    campaign: (Array.isArray(v.campaigns)
      ? v.campaigns[0]
      : v.campaigns) as CampaignRef,
  }));

  return (
    <div className="stack">
      <div className="stack" style={{ gap: '0.25rem' }}>
        <span className="eyebrow">Admin</span>
        <h1>Verification queue</h1>
        <p className="muted">
          Identity and document checks awaiting an admin decision.
        </p>
      </div>

      <section className="stack" style={{ gap: '0.75rem' }}>
        <h2>Awaiting review ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="muted">No verifications awaiting review.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Campaign</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td style={{ textTransform: 'capitalize' }}>
                    {v.type.replace(/_/g, ' ')}
                    <span className="small muted"> · via {v.verifier_type}</span>
                    {v.notes && (
                      <div className="small muted">{v.notes}</div>
                    )}
                  </td>
                  <td>
                    {v.campaign ? (
                      <Link href={`/admin/campaigns/${v.campaign.id}`}>
                        {v.campaign.title}
                      </Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={statusTone(v.status)}>
                      {v.status.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td>
                    <div
                      className="row wrap"
                      style={{ gap: '0.4rem', justifyContent: 'flex-end' }}
                    >
                      <form action={setVerificationForm.bind(null, v.id, 'approved')}>
                        <button type="submit" className="btn btn-primary btn-sm">
                          Approve
                        </button>
                      </form>
                      <form action={setVerificationForm.bind(null, v.id, 'rejected')}>
                        <button type="submit" className="btn btn-danger btn-sm">
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
    </div>
  );
}
