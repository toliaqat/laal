import type { Metadata } from 'next';
import Link from 'next/link';

type Params = { slug: string };
type Search = { session_id?: string };

export const metadata: Metadata = {
  title: 'Thank you for your donation',
  robots: { index: false },
};

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  // session_id is present when arriving from Stripe Checkout; we don't need it
  // to render, but await it so Next 15's async searchParams contract is met.
  await searchParams;

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <div
        aria-hidden
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#1a1a1a',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.75rem',
          marginBottom: '1.5rem',
        }}
      >
        ♥
      </div>
      <h1 style={{ marginTop: 0 }}>Thank you for your kindness</h1>
      <p style={{ color: '#444', fontSize: '1.05rem', lineHeight: 1.6 }}>
        Your donation has been received. Your contribution is held securely and
        will be released to the verified beneficiary. If you provided an email
        address, a receipt is on its way to your inbox.
      </p>
      <p style={{ color: '#444', fontSize: '1.05rem', lineHeight: 1.6 }}>
        On behalf of the family, thank you for your compassion in this difficult
        time.
      </p>
      <p style={{ marginTop: '2rem' }}>
        <Link
          href={`/campaigns/${slug}`}
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.25rem',
            borderRadius: 8,
            background: '#1a1a1a',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Return to the campaign
        </Link>
      </p>
    </main>
  );
}
