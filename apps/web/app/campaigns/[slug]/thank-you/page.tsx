import type { Metadata } from 'next';
import { Container, Card, Button } from '@/components/ui';

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
    <main className="section">
      <Container narrow>
        <Card large>
          <div className="stack center">
            <div
              aria-hidden
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--accent)',
                color: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
              }}
            >
              ♥
            </div>
            <h1 style={{ margin: 0 }}>Thank you for your kindness</h1>
            <p className="muted" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
              Your donation has been received. Your contribution is held securely
              and will be released to the verified beneficiary. If you provided an
              email address, a receipt is on its way to your inbox.
            </p>
            <p className="muted" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
              On behalf of the family, thank you for your compassion in this
              difficult time.
            </p>
            <div className="center" style={{ marginTop: '0.5rem' }}>
              <Button href={`/campaigns/${slug}`} variant="primary">
                Return to the campaign
              </Button>
            </div>
          </div>
        </Card>
      </Container>
    </main>
  );
}
