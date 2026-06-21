import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Campaign, Beneficiary } from '@laal/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { APP_URL } from '@/lib/env';
import { DonateForm } from '@/components/donate-form';
import { Container, Card, Progress, Badge, formatMoney } from '@/components/ui';

type Params = { slug: string };

async function getCampaign(slug: string): Promise<Campaign | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('campaigns')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return (data as Campaign | null) ?? null;
}

async function getActiveBeneficiary(
  campaignId: string,
): Promise<Beneficiary | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('beneficiaries')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('is_active', true)
    .maybeSingle();
  return (data as Beneficiary | null) ?? null;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getCampaign(slug);

  if (!campaign) {
    return {
      title: 'Story not found — Laal',
    };
  }

  const title = `${campaign.title} — Laal`;
  const description =
    campaign.story?.slice(0, 200) ??
    `A verified story on Laal, in memory of ${campaign.deceased_name}.`;
  const url = `${APP_URL()}/campaigns/${campaign.slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: campaign.cover_image_url ? [campaign.cover_image_url] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: campaign.cover_image_url ? [campaign.cover_image_url] : undefined,
    },
  };
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const campaign = await getCampaign(slug);

  if (!campaign) {
    notFound();
  }

  const beneficiary = await getActiveBeneficiary(campaign.id);

  const dob = formatDate(campaign.deceased_dob);
  const dod = formatDate(campaign.deceased_dod);
  const dates =
    dob && dod ? `${dob} – ${dod}` : dod ? `Died ${dod}` : dob ? `Born ${dob}` : null;

  const pct = campaign.goal_amount
    ? (campaign.amount_raised / campaign.goal_amount) * 100
    : 0;

  return (
    <main className="section">
      <Container narrow>
        <div className="stack" style={{ gap: '0.4rem' }}>
          <div className="row wrap">
            <span className="eyebrow">A story on Laal</span>
            {campaign.status === 'completed' ? (
              <Badge tone="success">Goal reached</Badge>
            ) : campaign.status === 'closed' ? (
              <Badge tone="danger">Closed</Badge>
            ) : null}
          </div>
          <h1 style={{ margin: 0 }}>{campaign.title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            In memory of <strong>{campaign.deceased_name}</strong>
            {dates ? ` · ${dates}` : ''}
          </p>
        </div>

        {campaign.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={campaign.cover_image_url}
            alt={campaign.deceased_name}
            style={{
              width: '100%',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--line)',
              margin: '1.5rem 0',
              objectFit: 'cover',
            }}
          />
        )}

        <Card style={{ margin: '1.5rem 0' }}>
          <div className="stack" style={{ gap: '0.75rem' }}>
            <Progress value={pct} />
            <p style={{ margin: 0 }}>
              <strong style={{ fontSize: '1.15rem' }}>
                {formatMoney(campaign.amount_raised, campaign.currency)}
              </strong>{' '}
              <span className="muted">
                raised of {formatMoney(campaign.goal_amount, campaign.currency)} goal
              </span>
            </p>
          </div>
        </Card>

        {campaign.story && (
          <section style={{ margin: '2rem 0' }}>
            <p
              style={{
                color: 'var(--ink)',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}
            >
              {campaign.story}
            </p>
          </section>
        )}

        {beneficiary && (
          <p
            className="small muted"
            style={{
              borderTop: '1px solid var(--line)',
              paddingTop: '1rem',
            }}
          >
            Your support reaches <strong>{beneficiary.display_name}</strong>
            {beneficiary.relationship_to_deceased
              ? ` (${beneficiary.relationship_to_deceased})`
              : ''}
            .
          </p>
        )}

        <Card large style={{ marginTop: '2rem' }}>
          <DonateForm
            campaignId={campaign.id}
            slug={campaign.slug}
            currency={campaign.currency}
            campaignTitle={campaign.title}
          />
        </Card>
      </Container>
    </main>
  );
}
