import { notFound } from 'next/navigation';
import { createAdminSupabase } from '@/lib/supabase/server';
import {
  approveCampaignForm,
  rejectCampaignForm,
  setVerificationForm,
  ensureOnboarding,
  releaseFundsForm,
} from '@/app/admin/actions';
import { canReleaseFunds } from '@ashfaat/types';
import type { VerificationStatus } from '@ashfaat/types';

export default async function AdminCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminSupabase();

  const { data: campaign } = await supabase
    .from('campaigns')
    .select(
      'id, title, slug, status, story, amount_raised, currency, deceased_name, created_at, published_at',
    )
    .eq('id', id)
    .single();
  if (!campaign) notFound();

  const { data: beneficiary } = await supabase
    .from('beneficiaries')
    .select(
      'id, type, display_name, relationship_to_deceased, stripe_connect_account_id, stripe_onboarding_complete, organization_id, organizations(name, contact_email, stripe_connect_account_id, stripe_onboarding_complete)',
    )
    .eq('campaign_id', id)
    .eq('is_active', true)
    .maybeSingle();

  const org = beneficiary
    ? Array.isArray(beneficiary.organizations)
      ? beneficiary.organizations[0]
      : beneficiary.organizations
    : null;

  const { data: verifications } = await supabase
    .from('verifications')
    .select('id, type, status, verifier_type, notes, reviewed_at, created_at')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false });

  const { data: documents } = await supabase
    .from('documents')
    .select('id, type, storage_path, status, verification_id')
    .eq('campaign_id', id);

  const { data: payouts } = await supabase
    .from('payouts')
    .select('id, amount, currency, status, released_at, stripe_transfer_id')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false });

  // Signed URLs for each document.
  const signedDocs = await Promise.all(
    (documents ?? []).map(async (d) => {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(d.storage_path, 60);
      return { ...d, url: data?.signedUrl ?? null };
    }),
  );

  const death =
    verifications?.find((v) => v.type === 'death')?.status ?? null;
  const relationship =
    verifications?.find((v) => v.type === 'relationship')?.status ?? null;

  const onboardingComplete = beneficiary
    ? beneficiary.type === 'organization'
      ? Boolean(org?.stripe_onboarding_complete) ||
        beneficiary.stripe_onboarding_complete
      : beneficiary.stripe_onboarding_complete
    : false;

  const eligible =
    beneficiary != null &&
    canReleaseFunds({
      beneficiaryType: beneficiary.type,
      beneficiaryOnboardingComplete: onboardingComplete,
      deathVerification: death as VerificationStatus | null,
      relationshipVerification: relationship as VerificationStatus | null,
    });

  const alreadyReleased = (payouts ?? [])
    .filter((p) => p.status !== 'failed' && p.status !== 'cancelled')
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const releasable = Number(campaign.amount_raised ?? 0) - alreadyReleased;

  // Build the reason the release button is disabled, if any.
  const reasons: string[] = [];
  if (!beneficiary) reasons.push('No active beneficiary.');
  if (!onboardingComplete) reasons.push('Beneficiary Stripe onboarding incomplete.');
  if (death !== 'approved') reasons.push('Death verification not approved.');
  if (
    beneficiary?.type === 'individual' &&
    relationship !== 'approved'
  ) {
    reasons.push('Relationship verification not approved.');
  }
  if (releasable <= 0) reasons.push('No un-released balance.');
  const canRelease = eligible && releasable > 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.6rem', margin: 0 }}>{campaign.title}</h1>
        <StatusBadge status={campaign.status} />
      </div>
      <p style={{ color: '#888', marginTop: '0.25rem' }}>
        In memory of {campaign.deceased_name} · {campaign.currency}{' '}
        {Number(campaign.amount_raised ?? 0).toFixed(2)} raised
      </p>

      {campaign.status === 'pending_review' && (
        <div style={{ display: 'flex', gap: '0.75rem', margin: '1rem 0' }}>
          <form action={approveCampaignForm.bind(null, campaign.id)}>
            <button type="submit" style={btn('#16794a')}>
              Approve campaign
            </button>
          </form>
          <form action={rejectCampaignForm.bind(null, campaign.id)}>
            <button type="submit" style={btn('#b3261e')}>
              Reject campaign
            </button>
          </form>
        </div>
      )}

      {campaign.story && (
        <Section title="Story">
          <p style={{ color: '#444', whiteSpace: 'pre-wrap' }}>{campaign.story}</p>
        </Section>
      )}

      {/* Beneficiary */}
      <Section title="Beneficiary">
        {!beneficiary ? (
          <p style={{ color: '#888' }}>No active beneficiary set.</p>
        ) : (
          <div style={card()}>
            <div>
              <strong>{beneficiary.display_name}</strong>{' '}
              <span style={{ color: '#888' }}>({beneficiary.type})</span>
              {beneficiary.relationship_to_deceased && (
                <div style={{ color: '#888', fontSize: '0.85rem' }}>
                  {beneficiary.relationship_to_deceased}
                </div>
              )}
              {org && (
                <div style={{ color: '#888', fontSize: '0.85rem' }}>
                  Org: {org.name}
                </div>
              )}
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              Stripe onboarding:{' '}
              <Badge ok={onboardingComplete}>
                {onboardingComplete ? 'complete' : 'incomplete'}
              </Badge>
            </div>
            <OnboardingLink beneficiaryId={beneficiary.id} />
          </div>
        )}
      </Section>

      {/* Verifications */}
      <Section title="Verifications">
        {(verifications ?? []).length === 0 ? (
          <p style={{ color: '#888' }}>No verifications submitted.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(verifications ?? []).map((v) => (
              <li key={v.id} style={{ ...card(), marginBottom: '0.75rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <strong style={{ textTransform: 'capitalize' }}>
                    {v.type}
                  </strong>
                  <StatusBadge status={v.status} />
                  <span style={{ color: '#aaa', fontSize: '0.8rem' }}>
                    via {v.verifier_type}
                  </span>
                </div>
                {v.notes && (
                  <p style={{ color: '#666', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
                    {v.notes}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                  <form action={setVerificationForm.bind(null, v.id, 'approved')}>
                    <button type="submit" style={btn('#16794a')}>
                      Approve
                    </button>
                  </form>
                  <form action={setVerificationForm.bind(null, v.id, 'rejected')}>
                    <button type="submit" style={btn('#b3261e')}>
                      Reject
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Documents */}
      <Section title="Documents">
        {signedDocs.length === 0 ? (
          <p style={{ color: '#888' }}>No documents uploaded.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {signedDocs.map((d) => (
              <li
                key={d.id}
                style={{
                  borderBottom: '1px solid #f0f0f0',
                  padding: '0.6rem 0',
                  display: 'flex',
                  gap: '1rem',
                }}
              >
                <span style={{ flex: 1, textTransform: 'capitalize' }}>
                  {d.type.replace(/_/g, ' ')}
                </span>
                <StatusBadge status={d.status} />
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer">
                    View
                  </a>
                ) : (
                  <span style={{ color: '#bbb' }}>unavailable</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Release funds */}
      <Section title="Release funds">
        <div style={card()}>
          <p style={{ margin: '0 0 0.5rem' }}>
            Un-released balance:{' '}
            <strong>
              {campaign.currency} {releasable.toFixed(2)}
            </strong>
            {alreadyReleased > 0 && (
              <span style={{ color: '#888' }}>
                {' '}
                ({campaign.currency} {alreadyReleased.toFixed(2)} already released)
              </span>
            )}
          </p>
          {!canRelease && reasons.length > 0 && (
            <ul style={{ color: '#b3261e', fontSize: '0.85rem', margin: '0 0 0.6rem', paddingLeft: '1.1rem' }}>
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          <form action={releaseFundsForm.bind(null, campaign.id)}>
            <button
              type="submit"
              disabled={!canRelease}
              style={{
                ...btn(canRelease ? '#16794a' : '#bbb'),
                cursor: canRelease ? 'pointer' : 'not-allowed',
              }}
            >
              Release funds
            </button>
          </form>
        </div>

        {(payouts ?? []).length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0' }}>
            {(payouts ?? []).map((p) => (
              <li
                key={p.id}
                style={{
                  borderBottom: '1px solid #f0f0f0',
                  padding: '0.5rem 0',
                  display: 'flex',
                  gap: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                <span style={{ flex: 1 }}>
                  {p.currency} {Number(p.amount ?? 0).toFixed(2)}
                </span>
                <StatusBadge status={p.status} />
                <span style={{ color: '#aaa' }}>
                  {p.released_at
                    ? new Date(p.released_at).toLocaleDateString()
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function OnboardingLink({ beneficiaryId }: { beneficiaryId: string }) {
  async function refresh() {
    'use server';
    const res = await ensureOnboarding(beneficiaryId);
    if (res.ok && res.url) {
      const { redirect } = await import('next/navigation');
      redirect(res.url);
    }
  }
  return (
    <form action={refresh} style={{ marginTop: '0.6rem' }}>
      <button type="submit" style={btn('#1a1a1a')}>
        Create / refresh onboarding link
      </button>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: '2rem' }}>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>{title}</h2>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    approved: '#16794a',
    active: '#16794a',
    paid: '#16794a',
    completed: '#16794a',
    rejected: '#b3261e',
    failed: '#b3261e',
    cancelled: '#b3261e',
    pending: '#9a6700',
    pending_review: '#9a6700',
    submitted: '#9a6700',
    held: '#9a6700',
    in_transit: '#1d4ed8',
    scheduled: '#1d4ed8',
  };
  const color = colors[status] ?? '#666';
  return (
    <span
      style={{
        background: `${color}1a`,
        color,
        borderRadius: 6,
        padding: '0.1rem 0.5rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const color = ok ? '#16794a' : '#b3261e';
  return (
    <span
      style={{
        background: `${color}1a`,
        color,
        borderRadius: 6,
        padding: '0.1rem 0.5rem',
        fontSize: '0.75rem',
        fontWeight: 600,
      }}
    >
      {children}
    </span>
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

function card(): React.CSSProperties {
  return {
    border: '1px solid #eee',
    borderRadius: 10,
    padding: '1rem',
  };
}
