import { Link } from '@/i18n/navigation';
import { ActionForm, SubmitButton } from '@/components/form';
import { createAdminSupabase } from '@/lib/supabase/server';
import { Badge, formatMoney, statusTone } from '@/components/ui';
import { refundDonation } from './actions';

const STATUSES = ['pending', 'succeeded', 'refunded', 'failed'] as const;

export default async function AdminDonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = createAdminSupabase();

  let query = supabase
    .from('donations')
    .select(
      'id, campaign_id, donor_name, donor_email, amount, currency, is_anonymous, status, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (status && STATUSES.includes(status as (typeof STATUSES)[number])) {
    query = query.eq('status', status);
  }

  const { data: donations } = await query;
  const rows = donations ?? [];

  // Resolve campaign titles via a lookup.
  const campaignIds = Array.from(
    new Set(rows.map((d) => d.campaign_id).filter(Boolean)),
  );
  const titles = new Map<string, string>();
  if (campaignIds.length > 0) {
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, title')
      .in('id', campaignIds);
    for (const c of campaigns ?? []) titles.set(c.id, c.title);
  }

  // A donation is refundable only before any of its campaign's funds are
  // released. Collect campaigns that already have a live payout so the UI hides
  // (and the action rejects) refunds for them.
  const releasedCampaignIds = new Set<string>();
  if (campaignIds.length > 0) {
    const { data: payouts } = await supabase
      .from('payouts')
      .select('campaign_id, status')
      .in('campaign_id', campaignIds);
    for (const p of payouts ?? []) {
      if (p.status !== 'failed' && p.status !== 'cancelled' && p.campaign_id) {
        releasedCampaignIds.add(p.campaign_id);
      }
    }
  }

  return (
    <div className="stack">
      <div className="stack" style={{ gap: '0.25rem' }}>
        <span className="eyebrow">Admin</span>
        <h1>Donations</h1>
        <p className="muted">The 100 most recent donations.</p>
      </div>

      <div className="row wrap" style={{ gap: '0.5rem' }}>
        <Link
          href="/admin/donations"
          className={`btn btn-sm ${!status ? 'btn-primary' : 'btn-ghost'}`}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/donations?status=${s}`}
            className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-ghost'}`}
          >
            {s}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="muted">No donations found.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Campaign</th>
              <th>Donor</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{new Date(d.created_at).toLocaleDateString()}</td>
                <td>
                  {d.campaign_id ? (
                    <Link href={`/admin/campaigns/${d.campaign_id}`}>
                      {titles.get(d.campaign_id) ?? 'Unknown campaign'}
                    </Link>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {d.is_anonymous
                    ? 'Anonymous'
                    : d.donor_name || d.donor_email || 'Anonymous'}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {formatMoney(Number(d.amount ?? 0), d.currency || 'EUR')}
                </td>
                <td>
                  <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {d.status === 'succeeded' &&
                  d.campaign_id &&
                  !releasedCampaignIds.has(d.campaign_id) ? (
                    <ActionForm action={refundDonation.bind(null, d.id)} showDetail>
                      <SubmitButton variant="ghost" size="sm">Refund</SubmitButton>
                    </ActionForm>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
