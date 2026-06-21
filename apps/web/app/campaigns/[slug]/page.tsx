import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Campaign, Beneficiary } from '@ashfaat/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { APP_URL } from '@/lib/env';
import { ProgressBar } from '@/components/progress-bar';
import { DonateForm } from '@/components/donate-form';

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
      title: 'Campaign not found — Ashfaat',
    };
  }

  const title = `${campaign.title} — Ashfaat`;
  const description =
    campaign.story?.slice(0, 200) ??
    `A verified memorial fund in memory of ${campaign.deceased_name}.`;
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

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <p style={{ color: '#888', fontSize: '0.875rem', marginBottom: 0 }}>
        Memorial fund
      </p>
      <h1 style={{ marginTop: '0.25rem', fontSize: '1.875rem', lineHeight: 1.2 }}>
        {campaign.title}
      </h1>

      <p style={{ color: '#555', marginTop: '0.5rem' }}>
        In memory of <strong>{campaign.deceased_name}</strong>
        {dates ? ` · ${dates}` : ''}
      </p>

      {campaign.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={campaign.cover_image_url}
          alt={campaign.deceased_name}
          style={{
            width: '100%',
            borderRadius: 12,
            margin: '1.5rem 0',
            objectFit: 'cover',
          }}
        />
      )}

      <ProgressBar
        raised={campaign.amount_raised}
        goal={campaign.goal_amount}
        currency={campaign.currency}
        style={{ margin: '1.5rem 0' }}
      />

      {campaign.story && (
        <section style={{ margin: '2rem 0' }}>
          <p style={{ color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {campaign.story}
          </p>
        </section>
      )}

      {beneficiary && (
        <p
          style={{
            color: '#555',
            fontSize: '0.875rem',
            borderTop: '1px solid #eee',
            paddingTop: '1rem',
          }}
        >
          Funds go to <strong>{beneficiary.display_name}</strong>
          {beneficiary.relationship_to_deceased
            ? ` (${beneficiary.relationship_to_deceased})`
            : ''}
          .
        </p>
      )}

      <section
        style={{
          marginTop: '2rem',
          padding: '1.5rem',
          border: '1px solid #e5e5e5',
          borderRadius: 12,
          background: '#fafafa',
        }}
      >
        <DonateForm
          campaignId={campaign.id}
          slug={campaign.slug}
          currency={campaign.currency}
          campaignTitle={campaign.title}
        />
      </section>
    </main>
  );
}
