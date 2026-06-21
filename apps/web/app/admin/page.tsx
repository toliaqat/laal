import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/server';
import {
  Badge,
  Card,
  ChartLegend,
  DonutChart,
  Stat,
  StatLink,
  formatMoney,
  statusTone,
} from '@/components/ui';

const ACTIVE_COLOR = 'var(--accent)';
const REMAINDER_COLOR = '#d8c4b0';

export default async function AdminAnalyticsPage() {
  const supabase = createAdminSupabase();

  const [
    campaignsRes,
    donationsRes,
    payoutsRes,
    verifsRes,
    orgsRes,
    recentRes,
  ] = await Promise.all([
    supabase.from('campaigns').select('id, status'),
    supabase.from('donations').select('amount, currency, status'),
    supabase.from('payouts').select('amount, currency, status'),
    supabase
      .from('verifications')
      .select('id')
      .in('status', ['pending', 'submitted']),
    supabase.from('organizations').select('id', { count: 'exact', head: true }),
    supabase
      .from('campaigns')
      .select('id, title, status, amount_raised, currency, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const campaigns = campaignsRes.data ?? [];
  const donations = donationsRes.data ?? [];
  const payouts = payoutsRes.data ?? [];
  const recent = recentRes.data ?? [];

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
  const pendingReview = campaigns.filter(
    (c) => c.status === 'pending_review',
  ).length;

  const succeeded = donations.filter((d) => d.status === 'succeeded');
  let totalRaised = 0;
  let raisedCurrency = 'EUR';
  for (const d of succeeded) {
    totalRaised += Number(d.amount ?? 0);
    if (d.currency) raisedCurrency = d.currency;
  }

  let totalReleased = 0;
  let releasedCurrency = raisedCurrency;
  for (const p of payouts) {
    if (p.status === 'failed' || p.status === 'cancelled') continue;
    totalReleased += Number(p.amount ?? 0);
    if (p.currency) releasedCurrency = p.currency;
  }

  const donationsCount = succeeded.length;
  const pendingVerifs = verifsRes.data?.length ?? 0;
  const totalOrgs = orgsRes.count ?? 0;

  // Donut framings: each pair is a subset of a whole, so the second slice is
  // the remainder (clamped at zero in case of data skew).
  const inactiveCampaigns = Math.max(totalCampaigns - activeCampaigns, 0);
  const heldFunds = Math.max(totalRaised - totalReleased, 0);

  return (
    <div className="stack">
      <div className="stack" style={{ gap: '0.25rem' }}>
        <span className="eyebrow">Admin</span>
        <h1>Analytics</h1>
        <p className="muted">Platform-wide overview at a glance.</p>
      </div>

      <div className="grid grid-stats">
        <Card>
          <div className="chart-card">
            <span className="stat-label">Campaigns</span>
            <DonutChart
              size={104}
              thickness={15}
              centerValue={String(totalCampaigns)}
              centerLabel="total"
              segments={[
                { label: 'Active', value: activeCampaigns, color: ACTIVE_COLOR },
                { label: 'Inactive', value: inactiveCampaigns, color: REMAINDER_COLOR },
              ]}
            />
            <ChartLegend
              items={[
                { label: 'Active', value: String(activeCampaigns), color: ACTIVE_COLOR },
                { label: 'Inactive', value: String(inactiveCampaigns), color: REMAINDER_COLOR },
              ]}
            />
          </div>
        </Card>

        <Card>
          <div className="chart-card">
            <span className="stat-label">Funds</span>
            <DonutChart
              size={104}
              thickness={15}
              centerValue={formatMoney(totalRaised, raisedCurrency)}
              centerLabel="raised"
              segments={[
                { label: 'Released', value: totalReleased, color: ACTIVE_COLOR },
                { label: 'Held', value: heldFunds, color: REMAINDER_COLOR },
              ]}
            />
            <ChartLegend
              items={[
                {
                  label: 'Released',
                  value: formatMoney(totalReleased, releasedCurrency),
                  color: ACTIVE_COLOR,
                },
                {
                  label: 'Held',
                  value: formatMoney(heldFunds, raisedCurrency),
                  color: REMAINDER_COLOR,
                },
              ]}
            />
          </div>
        </Card>

        <StatLink
          count={pendingReview}
          label="Campaigns pending review"
          href="/admin/campaigns"
        />
        <StatLink
          count={pendingVerifs}
          label="Verifications pending"
          href="/admin/verifications"
        />
        <Stat value={donationsCount} label="Donations" />
        <Stat value={totalOrgs} label="Organizations" />
      </div>

      <div className="stack" style={{ gap: '0.75rem' }}>
        <h2>Recent campaigns</h2>
        {recent.length === 0 ? (
          <p className="muted">No campaigns yet.</p>
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
              {recent.map((c) => (
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
                      c.currency || raisedCurrency,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
