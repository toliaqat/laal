import Link from 'next/link';
import type { Campaign } from '@ashfaat/types';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  Container,
  Card,
  Button,
  Progress,
  formatMoney,
} from '@/components/ui';

export const metadata = {
  title: 'Laal — Everyone is someone’s Laal',
  description:
    'Laal brings communities together to support families with dignity. Every need is verified, every act of kindness reaches the people who matter.',
};

async function getFeaturedCampaigns(): Promise<Campaign[]> {
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .order('published_at', { ascending: false })
      .limit(6);
    return (data as Campaign[] | null) ?? [];
  } catch {
    return [];
  }
}

const STEPS = [
  {
    title: 'Share a story',
    body: 'A friend, colleague, or family member shares someone’s story in minutes.',
  },
  {
    title: 'Give with confidence',
    body: 'Supporters contribute securely — no account required to help.',
  },
  {
    title: 'Every need is verified',
    body: 'Our team gently confirms the people and the need before anything moves.',
  },
  {
    title: 'Support reaches the family',
    body: 'Your contribution reaches a confirmed family member or trusted partner.',
  },
];

export default async function HomePage() {
  const campaigns = await getFeaturedCampaigns();

  return (
    <main>
      <section className="hero hero-bg">
        <Container narrow>
          <div className="stack center">
            <span className="eyebrow">Every life is precious</span>
            <h1 style={{ marginTop: 0 }}>
              Everyone is someone’s Laal.
            </h1>
            <p className="muted" style={{ fontSize: '1.125rem', maxWidth: '46ch', margin: '0 auto' }}>
              A mother. A father. A child. A dream. Behind every request is a
              person who matters.
            </p>
            <div className="row wrap center" style={{ justifyContent: 'center', marginTop: '0.5rem' }}>
              <Button href="/start" variant="primary">
                Support Someone Today
              </Button>
              <Button href="/campaigns" variant="ghost">
                Browse stories
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <section className="section">
        <Container narrow>
          <div className="stack center">
            <span className="eyebrow">What Laal is</span>
            <h2 style={{ marginTop: 0 }}>A warm, trusted place to help</h2>
            <p className="muted" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
              When a family faces a hard moment, they often carry costs, worry,
              and uncertainty all at once. Laal is a calm, caring way for friends
              and community to step in — every story is gently verified, and
              every act of kindness reaches the family who needs it.
            </p>
          </div>
        </Container>
      </section>

      <section className="section" style={{ background: 'var(--surface-2)' }}>
        <Container>
          <div className="stack center" style={{ marginBottom: '2rem' }}>
            <span className="eyebrow">How it works</span>
            <h2 style={{ marginTop: 0 }}>Four gentle steps</h2>
          </div>
          <div className="grid grid-cards">
            {STEPS.map((step, i) => (
              <Card key={step.title}>
                <div className="stack" style={{ gap: '0.5rem' }}>
                  <span className="eyebrow">Step {i + 1}</span>
                  <h3 style={{ margin: 0 }}>{step.title}</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    {step.body}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section className="section">
        <Container>
          <div className="row-between wrap" style={{ marginBottom: '1.5rem' }}>
            <div className="stack" style={{ gap: '0.25rem' }}>
              <span className="eyebrow">Featured stories</span>
              <h2 style={{ margin: 0 }}>Stories you can support</h2>
            </div>
            <Button href="/campaigns" variant="ghost" size="sm">
              View all
            </Button>
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
                    Share the first story
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
                          <strong>{formatMoney(c.amount_raised, c.currency)}</strong>{' '}
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
      </section>

      <section className="section hero-bg">
        <Container narrow>
          <div className="stack center">
            <h2 style={{ marginTop: 0 }}>Be there when it matters most</h2>
            <p className="muted" style={{ fontSize: '1.05rem' }}>
              Share the story of someone you care about, or stand with a family
              in their hardest moment.
            </p>
            <div className="row wrap center" style={{ justifyContent: 'center', marginTop: '0.5rem' }}>
              <Button href="/start" variant="primary">
                Support Someone Today
              </Button>
              <Button href="/campaigns" variant="ghost">
                Browse stories
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
