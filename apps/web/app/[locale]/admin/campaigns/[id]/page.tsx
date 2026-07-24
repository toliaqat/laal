import { notFound } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/form';
import { createAdminSupabase } from '@/lib/supabase/server';
import { presignDownload } from '@/lib/r2';
import {
  approveCampaign,
  rejectCampaign,
  setVerification,
  ensureOnboarding,
  releaseFunds,
  pauseCampaign,
  resumeCampaign,
  closeCampaign,
  recomputeAmountRaised,
} from '@/app/[locale]/admin/actions';
import { canReleaseFunds } from '@laal/types';
import type { VerificationStatus } from '@laal/types';
import { Card, Badge, formatMoney, statusTone } from '@/components/ui';
import type { ReactNode } from 'react';

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
      'id, title, slug, status, story, cover_image_url, amount_raised, currency, deceased_name, created_at, published_at',
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

  // Short-lived presigned R2 URLs for each document.
  const signedDocs = await Promise.all(
    (documents ?? []).map(async (d) => {
      let url: string | null = null;
      try {
        url = await presignDownload(d.storage_path, 300);
      } catch {
        url = null;
      }
      return { ...d, url };
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

  const currency = campaign.currency || 'EUR';

  return (
    <div className="stack">
      <div className="stack" style={{ gap: '0.25rem' }}>
        <span className="eyebrow">Campaign</span>
        <div className="row" style={{ gap: '0.75rem', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>{campaign.title}</h1>
          <Badge tone={statusTone(campaign.status)}>
            {campaign.status.replace(/_/g, ' ')}
          </Badge>
        </div>
        <p className="muted">
          In memory of {campaign.deceased_name} ·{' '}
          {formatMoney(Number(campaign.amount_raised ?? 0), currency)} raised
        </p>
      </div>

      {campaign.status === 'pending_review' && (
        <div className="row wrap" style={{ gap: '0.5rem' }}>
          <ActionForm action={approveCampaign.bind(null, campaign.id)} showDetail>
            <SubmitButton size="sm">Approve fundraiser</SubmitButton>
          </ActionForm>
          <ActionForm action={rejectCampaign.bind(null, campaign.id)} showDetail>
            <SubmitButton variant="danger" size="sm">Reject campaign</SubmitButton>
          </ActionForm>
        </div>
      )}

      {campaign.cover_image_url && (
        <Section title="Cover photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={campaign.cover_image_url}
            alt={`Cover photo for ${campaign.deceased_name}`}
            style={{
              maxWidth: '100%',
              maxHeight: 320,
              objectFit: 'cover',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--line)',
            }}
          />
        </Section>
      )}

      {campaign.story && (
        <Section title="Story">
          <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>
            {campaign.story}
          </p>
        </Section>
      )}

      {/* Beneficiary */}
      <Section title="Beneficiary">
        {!beneficiary ? (
          <p className="muted">No active beneficiary set.</p>
        ) : (
          <Card>
            <div className="stack" style={{ gap: '0.5rem' }}>
              <div>
                <strong>{beneficiary.display_name}</strong>{' '}
                <span className="muted">({beneficiary.type})</span>
                {beneficiary.relationship_to_deceased && (
                  <div className="small muted">
                    {beneficiary.relationship_to_deceased}
                  </div>
                )}
                {org && <div className="small muted">Org: {org.name}</div>}
              </div>
              <div className="row" style={{ gap: '0.5rem' }}>
                <span>Stripe onboarding:</span>
                <Badge tone={onboardingComplete ? 'success' : 'danger'}>
                  {onboardingComplete ? 'complete' : 'incomplete'}
                </Badge>
              </div>
              <OnboardingLink beneficiaryId={beneficiary.id} />
            </div>
          </Card>
        )}
      </Section>

      {/* Verifications */}
      <Section title="Fundraiser review">
        {(verifications ?? []).length === 0 ? (
          <p className="muted">Nothing submitted for review yet.</p>
        ) : (
          <div className="stack" style={{ gap: '0.75rem' }}>
            {(verifications ?? []).map((v) => (
              <Card key={v.id}>
                <div className="stack" style={{ gap: '0.5rem' }}>
                  <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                    <strong style={{ textTransform: 'capitalize' }}>
                      {v.type}
                    </strong>
                    <Badge tone={statusTone(v.status)}>
                      {v.status.replace(/_/g, ' ')}
                    </Badge>
                    <span className="small muted">via {v.verifier_type}</span>
                  </div>
                  {v.notes && <p className="small muted">{v.notes}</p>}
                  <div className="row wrap" style={{ gap: '0.4rem' }}>
                    <ActionForm action={setVerification.bind(null, v.id, 'approved')} showDetail>
                      <SubmitButton size="sm">Mark need verified</SubmitButton>
                    </ActionForm>
                    <ActionForm action={setVerification.bind(null, v.id, 'rejected')} showDetail>
                      <SubmitButton variant="danger" size="sm">Needs more info</SubmitButton>
                    </ActionForm>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* Documents */}
      <Section title="Documents">
        {signedDocs.length === 0 ? (
          <p className="muted">No documents uploaded.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Link</th>
              </tr>
            </thead>
            <tbody>
              {signedDocs.map((d) => (
                <tr key={d.id}>
                  <td style={{ textTransform: 'capitalize' }}>
                    {d.type.replace(/_/g, ' ')}
                  </td>
                  <td>
                    <Badge tone={statusTone(d.status)}>
                      {d.status.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {d.url ? (
                      <a href={d.url} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    ) : (
                      <span className="muted">unavailable</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Release funds */}
      <Section title="Deliver support">
        <Card>
          <div className="stack" style={{ gap: '0.6rem' }}>
            <p style={{ margin: 0 }}>
              Un-released balance:{' '}
              <strong>{formatMoney(releasable, currency)}</strong>
              {alreadyReleased > 0 && (
                <span className="muted">
                  {' '}
                  ({formatMoney(alreadyReleased, currency)} already released)
                </span>
              )}
            </p>
            {!canRelease && reasons.length > 0 && (
              <ul className="small" style={{ color: 'var(--danger, #b3261e)', margin: 0, paddingLeft: '1.1rem' }}>
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            {canRelease ? (
              <ActionForm action={releaseFunds.bind(null, campaign.id)} showDetail>
                <SubmitButton size="sm">Deliver support</SubmitButton>
              </ActionForm>
            ) : (
              <button type="submit" disabled className="btn btn-primary btn-sm">
                Deliver support
              </button>
            )}
          </div>
        </Card>

        {(payouts ?? []).length > 0 && (
          <table className="table" style={{ marginTop: '1rem' }}>
            <thead>
              <tr>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Released</th>
              </tr>
            </thead>
            <tbody>
              {(payouts ?? []).map((p) => (
                <tr key={p.id}>
                  <td>
                    {formatMoney(
                      Number(p.amount ?? 0),
                      p.currency || currency,
                    )}
                  </td>
                  <td>
                    <Badge tone={statusTone(p.status)}>
                      {p.status.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {p.released_at
                      ? new Date(p.released_at).toLocaleDateString()
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Maintenance */}
      <Section title="Maintenance">
        <Card>
          <div className="stack" style={{ gap: '0.6rem' }}>
            <p className="small muted" style={{ margin: 0 }}>
              Recompute re-sums succeeded donations into the stored raised total.
            </p>
            <div className="row wrap" style={{ gap: '0.4rem' }}>
              {campaign.status === 'active' && (
                <ActionForm action={pauseCampaign.bind(null, campaign.id)} showDetail>
                  <SubmitButton variant="ghost" size="sm">Pause</SubmitButton>
                </ActionForm>
              )}
              {campaign.status === 'paused' && (
                <ActionForm action={resumeCampaign.bind(null, campaign.id)} showDetail>
                  <SubmitButton variant="ghost" size="sm">Resume</SubmitButton>
                </ActionForm>
              )}
              <ActionForm action={recomputeAmountRaised.bind(null, campaign.id)} showDetail>
                <SubmitButton variant="ghost" size="sm">Recompute raised</SubmitButton>
              </ActionForm>
              {campaign.status !== 'closed' && (
                <ActionForm action={closeCampaign.bind(null, campaign.id)} showDetail>
                  <SubmitButton variant="danger" size="sm">Close</SubmitButton>
                </ActionForm>
              )}
            </div>
          </div>
        </Card>
      </Section>
    </div>
  );
}

function OnboardingLink({ beneficiaryId }: { beneficiaryId: string }) {
  // ensureOnboarding redirects to the hosted Stripe flow on success and
  // returns a visible error otherwise (previously failures were swallowed).
  return (
    <ActionForm action={ensureOnboarding.bind(null, beneficiaryId)} showDetail>
      <SubmitButton variant="ghost" size="sm">
        Create / refresh onboarding link
      </SubmitButton>
    </ActionForm>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="stack" style={{ gap: '0.75rem' }}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
