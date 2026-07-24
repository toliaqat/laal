import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createAdminSupabase, getCurrentUser } from '@/lib/supabase/server';
import { getMyMemberships } from '@/lib/org-auth';
import { presignDownload } from '@/lib/r2';
import { Button, Card, Field } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/form';
import { reviewVerification, startOrgOnboarding, updateOrgProfile } from './actions';

function money(amount: number, currency: string): string {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

export default async function OrgPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('org');
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/org');

  const memberships = await getMyMemberships();
  if (memberships.length === 0) {
    return (
      <div className="container narrow">
        <Card>
          <h1>{t('portalTitle')}</h1>
          <p className="muted">{t('noMembership')}</p>
        </Card>
      </div>
    );
  }

  const supabase = createAdminSupabase();

  const sections = await Promise.all(
    memberships.map(async (m) => {
      const orgId = m.organizationId;
      const { data: org } = await supabase
        .from('organizations')
        .select(
          'id, name, type, country, description, contact_email, contact_phone, logo_url, status, can_be_beneficiary, stripe_connect_account_id, stripe_onboarding_complete',
        )
        .eq('id', orgId)
        .single();

      const { data: campaigns } = await supabase
        .from('beneficiaries')
        .select('campaign_id, campaigns:campaign_id(id, title, slug, status, amount_raised, goal_amount, currency)')
        .eq('organization_id', orgId)
        .eq('type', 'organization')
        .eq('is_active', true);

      const campaignIds = (campaigns ?? [])
        .map((c) => c.campaign_id as string)
        .filter(Boolean);

      const { data: verifications } = campaignIds.length
        ? await supabase
            .from('verifications')
            .select('id, campaign_id, type, status, reviewed_at')
            .in('campaign_id', campaignIds)
            .order('created_at', { ascending: false })
        : { data: [] };

      // Leads need to see the supporting documents (death certificate, etc.) to
      // make a real verification decision. Presign short-lived GET URLs from the
      // private bucket; only fetched for leads (staff get no document access).
      const isLeadHere = m.orgRole === 'lead';
      const { data: rawDocs } =
        isLeadHere && campaignIds.length
          ? await supabase
              .from('documents')
              .select('id, campaign_id, type, storage_path')
              .in('campaign_id', campaignIds)
          : { data: [] };
      const documents = await Promise.all(
        (rawDocs ?? []).map(async (d) => ({
          id: d.id as string,
          campaign_id: d.campaign_id as string,
          type: d.type as string,
          url: await presignDownload(d.storage_path as string).catch(() => null),
        })),
      );

      const { data: payouts } = await supabase
        .from('payouts')
        .select('amount, currency, status, released_at, beneficiaries!inner(organization_id)')
        .eq('beneficiaries.organization_id', orgId)
        .order('released_at', { ascending: false });

      return {
        membership: m,
        org,
        campaigns: campaigns ?? [],
        verifications: verifications ?? [],
        documents,
        payouts: payouts ?? [],
      };
    }),
  );

  return (
    <div className="container">
      <div className="stack">
        <div>
          <p className="eyebrow">{t('portalTitle')}</p>
          <h1>{t('yourOrganizations', { count: sections.length })}</h1>
        </div>

        {sections.map(({ membership, org, campaigns, verifications, documents, payouts }) => {
          if (!org) return null;
          const isLead = membership.orgRole === 'lead';
          const titleByCampaign = new Map<string, string>();
          for (const c of campaigns) {
            const camp = Array.isArray(c.campaigns) ? c.campaigns[0] : c.campaigns;
            if (camp?.id) titleByCampaign.set(camp.id as string, camp.title as string);
          }
          // Total received, grouped by currency: an org can be the beneficiary
          // of fundraisers in different currencies, and summing those into one
          // number (labelled with a single arbitrary currency) is meaningless.
          const receivedByCurrency = new Map<string, number>();
          for (const p of payouts) {
            if (p.status === 'failed' || p.status === 'cancelled') continue;
            const cur = (p.currency as string) || 'EUR';
            receivedByCurrency.set(
              cur,
              (receivedByCurrency.get(cur) ?? 0) + Number(p.amount ?? 0),
            );
          }
          const receivedTotals = [...receivedByCurrency.entries()];

          return (
            <div key={org.id} className="stack">
              {/* Status */}
              <Card>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h2 style={{ margin: 0 }}>{org.name}</h2>
                  <span className="small muted">{org.type}</span>
                </div>
                <div className="row wrap small" style={{ gap: '1rem', marginTop: '0.5rem' }}>
                  <span>
                    {t('listingLabel')}{' '}
                    <strong>
                      {org.status === 'verified' ? t('listingVerified') : org.status}
                    </strong>
                  </span>
                  <span>
                    {t('payoutsLabel')}{' '}
                    <strong>
                      {org.stripe_onboarding_complete
                        ? t('payoutsReady')
                        : t('payoutsNotConnected')}
                    </strong>
                  </span>
                </div>
                {isLead && !org.stripe_onboarding_complete && (
                  <ActionForm action={startOrgOnboarding} style={{ marginTop: '0.75rem' }}>
                    <input type="hidden" name="organization_id" value={org.id} />
                    <SubmitButton>
                      {org.stripe_connect_account_id
                        ? t('finishBankSetup')
                        : t('connectBank')}
                    </SubmitButton>
                  </ActionForm>
                )}
                {org.status !== 'verified' && (
                  <p className="muted small" style={{ marginTop: '0.5rem' }}>
                    {t('reviewNotice')}
                  </p>
                )}
              </Card>

              {/* Funds received */}
              <Card>
                <h3>{t('fundsReceived')}</h3>
                <p className="muted">
                  {t('totalReceived')}{' '}
                  {receivedTotals.length === 0 ? (
                    <strong>{money(0, 'EUR')}</strong>
                  ) : (
                    receivedTotals.map(([cur, amt], i) => (
                      <strong key={cur}>
                        {i > 0 ? ' · ' : ''}
                        {money(amt, cur)}
                      </strong>
                    ))
                  )}
                </p>
                {payouts.length === 0 ? (
                  <p className="muted small">{t('noPayouts')}</p>
                ) : (
                  <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
                    {payouts.map((p, i) => (
                      <li key={i} className="row small" style={{ justifyContent: 'space-between' }}>
                        <span>{money(Number(p.amount), p.currency as string)}</span>
                        <span className="muted">{p.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* Fundraisers designating this org */}
              <Card>
                <h3>{t('fundraisersDesignatingYou')}</h3>
                {campaigns.length === 0 ? (
                  <p className="muted small">{t('noActiveFundraisers')}</p>
                ) : (
                  <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
                    {campaigns.map((c, i) => {
                      const camp = Array.isArray(c.campaigns) ? c.campaigns[0] : c.campaigns;
                      if (!camp) return null;
                      return (
                        <li key={i} className="row" style={{ justifyContent: 'space-between' }}>
                          <span>{camp.title}</span>
                          <span className="small muted">
                            {money(Number(camp.amount_raised), camp.currency)} · {camp.status}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>

              {/* Verifications to review (lead only) */}
              {isLead && verifications.length > 0 && (
                <Card>
                  <h3>{t('verificationsToReview')}</h3>
                  <p className="muted small">{t('verificationsHint')}</p>
                  {documents.length > 0 && (
                    <div className="stack" style={{ gap: '0.4rem', marginBottom: '0.75rem' }}>
                      <h4 className="small" style={{ margin: 0 }}>{t('supportingDocuments')}</h4>
                      {documents.map((d) => (
                        <div
                          key={d.id}
                          className="row small"
                          style={{ justifyContent: 'space-between' }}
                        >
                          <span>
                            {titleByCampaign.get(d.campaign_id) ?? t('fundraiserFallback')} ·{' '}
                            {d.type.replace(/_/g, ' ')}
                          </span>
                          {d.url ? (
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="nav-link"
                            >
                              {t('view')}
                            </a>
                          ) : (
                            <span className="muted">{t('unavailable')}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
                    {verifications.map((v) => {
                      const decided =
                        v.status === 'approved' || v.status === 'rejected';
                      return (
                        <li
                          key={v.id}
                          className="row"
                          style={{ justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <span className="small">
                            {titleByCampaign.get(v.campaign_id as string) ?? t('fundraiserFallback')} ·{' '}
                            {v.type} · <strong>{v.status}</strong>
                          </span>
                          {decided ? (
                            <span className="small muted">{t('reviewed')}</span>
                          ) : (
                            <span className="row" style={{ gap: '0.5rem' }}>
                              <ActionForm action={reviewVerification}>
                                <input type="hidden" name="verification_id" value={v.id} />
                                <input type="hidden" name="status" value="approved" />
                                <SubmitButton>{t('approve')}</SubmitButton>
                              </ActionForm>
                              <ActionForm action={reviewVerification}>
                                <input type="hidden" name="verification_id" value={v.id} />
                                <input type="hidden" name="status" value="rejected" />
                                <SubmitButton variant="ghost">
                                  {t('reject')}
                                </SubmitButton>
                              </ActionForm>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}

              {/* Profile (lead only) */}
              {isLead && (
                <Card>
                  <h3>{t('orgProfile')}</h3>
                  <ActionForm action={updateOrgProfile} className="stack">
                    <input type="hidden" name="organization_id" value={org.id} />
                    <Field label={t('fieldName')}>
                      <input className="input" name="name" defaultValue={org.name ?? ''} required />
                    </Field>
                    <Field label={t('fieldDescription')}>
                      <textarea
                        className="textarea"
                        name="description"
                        rows={4}
                        defaultValue={org.description ?? ''}
                      />
                    </Field>
                    <div className="grid">
                      <Field label={t('fieldCountry')}>
                        <input className="input" name="country" defaultValue={org.country ?? ''} />
                      </Field>
                      <Field label={t('fieldContactEmail')}>
                        <input
                          className="input"
                          type="email"
                          name="contact_email"
                          defaultValue={org.contact_email ?? ''}
                        />
                      </Field>
                      <Field label={t('fieldContactPhone')}>
                        <input
                          className="input"
                          name="contact_phone"
                          defaultValue={org.contact_phone ?? ''}
                        />
                      </Field>
                      <Field label={t('fieldLogoUrl')}>
                        <input className="input" name="logo_url" defaultValue={org.logo_url ?? ''} />
                      </Field>
                    </div>
                    <div className="row">
                      <SubmitButton>{t('saveProfile')}</SubmitButton>
                    </div>
                  </ActionForm>
                </Card>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
