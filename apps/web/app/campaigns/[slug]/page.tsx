import type { Metadata } from 'next';

// Placeholder campaign page. This is the viral, shareable surface — it must
// render server-side with rich Open Graph tags so links preview well in
// WhatsApp / social. Wire it to Supabase (fetch campaign by slug) next.

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Memorial fund — ${slug}`,
    description: 'Contribute to this verified memorial fund on Ashfaat.',
    openGraph: {
      title: `Memorial fund — ${slug}`,
      description: 'Contribute to this verified memorial fund on Ashfaat.',
      type: 'website',
    },
  };
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <p style={{ color: '#888', fontSize: '0.875rem', marginBottom: 0 }}>
        Campaign
      </p>
      <h1 style={{ marginTop: '0.25rem' }}>{slug}</h1>
      <p style={{ color: '#555' }}>
        TODO: fetch this campaign from Supabase by slug, render the story, raised
        / goal progress, and a Donate button (Stripe Checkout).
      </p>
    </main>
  );
}
