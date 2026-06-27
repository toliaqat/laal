import { Link } from '@/i18n/navigation';
import { createAdminSupabase } from '@/lib/supabase/server';
import { releaseFundsForm } from '@/app/[locale]/admin/actions';
import { Badge, Button, formatMoney } from '@/components/ui';
import { canReleaseFunds } from '@laal/types';
import type { VerificationStatus } from '@laal/types';

/**
 * Admin release queue. Surfaces every collecting fundraiser and whether its
 * release gate is satisfied, so an admin can do the money-release co-sign in one
 * place instead of opening each fundraiser. Release stays admin-only — this is
 * the second set of eyes after a chapter lead verifies.
 */
export default async function ReleasesPage() {
  const supabase = createAdminSupabase();

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, title, currency, amount_raised, status')
    .eq('status', 'active')
    .order('published_at', { ascending: false });

  const rows = await Promise.all(
    (campaigns ?? []).map(async (c) => {
      const { data: beneficiary } = await supabase
        .from('beneficiaries')
        .select(
          'type, display_name, stripe_onboarding_complete, organizations(name, stripe_onboarding_complete)',
        )
        .eq('campaign_id', c.id)
        .eq('is_active', true)
        .maybeSingle();

      const org = Array.isArray(beneficiary?.organizations)
        ? beneficiary?.organizations[0]
        : beneficiary?.organizations;

      const onboardingComplete =
        beneficiary?.type === 'organization'
          ? Boolean(org?.stripe_onboarding_complete) ||
            Boolean(beneficiary?.stripe_onboarding_complete)
          : Boolean(beneficiary?.stripe_onboarding_complete);

      const { data: verifications } = await supabase
        .from('verifications')
        .select('type, status, created_at')
        .eq('campaign_id', c.id)
        .order('created_at', { ascending: false });

      const death =
        (verifications?.find((v) => v.type === 'death')?.status as
          | VerificationStatus
          | undefined) ?? null;
      const relationship =
        (verifications?.find((v) => v.type === 'relationship')?.status as
          | VerificationStatus
          | undefined) ?? null;

      const { data: payouts } = await supabase
        .from('payouts')
        .select('amount, status')
        .eq('campaign_id', c.id);
      const alreadyReleased = (payouts ?? [])
        .filter((p) => p.status !== 'failed' && p.status !== 'cancelled')
        .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
      const releasable = Number(c.amount_raised ?? 0) - alreadyReleased;

      const gateOpen = canReleaseFunds({
        beneficiaryType: (beneficiary?.type ?? 'organization') as
          | 'organization'
          | 'individual',
        beneficiaryOnboardingComplete: onboardingComplete,
        deathVerification: death,
        relationshipVerification: relationship,
      });

      const blockers: string[] = [];
      if (death !== 'approved') blockers.push('death verification');
      if (beneficiary?.type === 'individual' && relationship !== 'approved') {
        blockers.push('relationship verification');
      }
      if (!onboardingComplete) blockers.push('bank connection');

      return {
        id: c.id,
        title: c.title,
        currency: c.currency || 'EUR',
        beneficiaryName: org?.name ?? beneficiary?.display_name ?? '—',
        beneficiaryType: beneficiary?.type ?? null,
        releasable,
        ready: gateOpen && releasable > 0,
        blockers,
      };
    }),
  );

  const ready = rows.filter((r) => r.ready);
  const blocked = rows.filter((r) => !r.ready);

  return (
    <div className="stack">
      <div className="stack" style={{ gap: '0.25rem' }}>
        <span className="eyebrow">Admin</span>
        <h1>Releases</h1>
        <p className="muted">
          Fundraisers whose funds are ready to send to the beneficiary. Release
          is the admin co-sign — a chapter lead verifies, you release.
        </p>
      </div>

      <section className="stack" style={{ gap: '0.75rem' }}>
        <h2>Ready to release ({ready.length})</h2>
        {ready.length === 0 ? (
          <p className="muted">Nothing ready to release right now.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fundraiser</th>
                <th>Beneficiary</th>
                <th style={{ textAlign: 'right' }}>Releasable</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {ready.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/campaigns/${r.id}`}>{r.title}</Link>
                  </td>
                  <td>{r.beneficiaryName}</td>
                  <td style={{ textAlign: 'right' }}>
                    {formatMoney(r.releasable, r.currency)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <form action={releaseFundsForm.bind(null, r.id)}>
                      <Button type="submit">Release funds</Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="stack" style={{ gap: '0.75rem' }}>
        <h2>Awaiting requirements ({blocked.length})</h2>
        {blocked.length === 0 ? (
          <p className="muted">No collecting fundraisers are blocked.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fundraiser</th>
                <th>Beneficiary</th>
                <th style={{ textAlign: 'right' }}>Raised (unreleased)</th>
                <th>Still needs</th>
              </tr>
            </thead>
            <tbody>
              {blocked.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/campaigns/${r.id}`}>{r.title}</Link>
                  </td>
                  <td>{r.beneficiaryName}</td>
                  <td style={{ textAlign: 'right' }}>
                    {formatMoney(r.releasable, r.currency)}
                  </td>
                  <td>
                    <div className="row wrap" style={{ gap: '0.4rem' }}>
                      {r.blockers.length === 0 ? (
                        <Badge tone="default">nothing to release</Badge>
                      ) : (
                        r.blockers.map((b) => (
                          <Badge key={b} tone="warning">
                            {b}
                          </Badge>
                        ))
                      )}
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
