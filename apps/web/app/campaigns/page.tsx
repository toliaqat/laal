import Link from 'next/link';
import type { Campaign } from '@laal/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { Container, Card, Button, Progress, formatMoney } from '@/components/ui';

export const metadata = {
  title: 'Stories — Laal',
  description: 'Verified stories you can support with an act of kindness.',
};

export default async function CampaignsPage() {
  let campaigns: Campaign[] = [];
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .order('published_at', { ascending: false });
    campaigns = (data as Campaign[] | null) ?? [];
  } catch {
    campaigns = [];
  }

  return (
    <main className="section">
      <Container>
        <div className="stack" style={{ gap: '0.25rem', marginBottom: '2rem' }}>
          <span className="eyebrow">Stories</span>
          <h1 style={{ margin: 0 }}>Stories you can support</h1>
          <p className="muted" style={{ margin: 0 }}>
            Every story is gently verified before your support reaches the
            family.
          </p>
        </div>

        {campaigns.length === 0 ? (
          <Card large>
            <div className="stack center">
              <p className="muted" style={{ margin: 0 }}>
                New stories are being reviewed. Check back soon to support
                someone precious.
              </p>
              <div className="center">
                <Button href="/start" variant="primary" size="sm">
                  Share a story
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cards">
            {campaigns.map((c) => {
              const pct = c.goal_amount
                ? (c.amount_raised / c.goal_amount) * 100
                : 0;
              return (
                <Link
                  key={c.id}
                  href={`/campaigns/${c.slug}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <Card hover>
                    <div className="stack" style={{ gap: '0.75rem' }}>
                      <h3 style={{ margin: 0 }}>{c.title}</h3>
                      <p className="small muted" style={{ margin: 0 }}>
                        In memory of {c.deceased_name}
                      </p>
                      <Progress value={pct} />
                      <p className="small" style={{ margin: 0 }}>
                        <strong>
                          {formatMoney(c.amount_raised, c.currency)}
                        </strong>{' '}
                        <span className="muted">
                          of {formatMoney(c.goal_amount, c.currency)}
                        </span>
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </Container>
    </main>
  );
}
