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
  title: 'Ashfaat — Memorial fundraising for expat families',
  description:
    'Dignified, verified memorial fundraising for expats and their families.',
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
    title: 'Create a campaign',
    body: 'A friend, colleague, or family member starts a memorial fund in minutes.',
  },
  {
    title: 'Give with confidence',
    body: 'Donors contribute securely — no account required to give.',
  },
  {
    title: 'We verify',
    body: 'Our team confirms the death and the people involved before funds move.',
  },
  {
    title: 'Funds reach a beneficiary',
    body: 'Money is released to a verified family member or partner organisation.',
  },
];

export default async function HomePage() {
  const campaigns = await getFeaturedCampaigns();

  return (
    <main>
      <section className="hero hero-bg">
        <Container narrow>
          <div className="stack center">
            <span className="eyebrow">Memorial fundraising</span>
            <h1 style={{ marginTop: 0 }}>
              Stand with families when an expat passes away abroad
            </h1>
            <p className="muted" style={{ fontSize: '1.125rem', maxWidth: '46ch', margin: '0 auto' }}>
              Ashfaat brings communities together to ease the burden of loss far
              from home — with dignity, transparency, and verified care.
            </p>
            <div className="row wrap center" style={{ justifyContent: 'center', marginTop: '0.5rem' }}>
              <Button href="/start" variant="primary">
                Start a campaign
              </Button>
              <Button href="/campaigns" variant="ghost">
                Browse campaigns
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <section className="section">
        <Container narrow>
          <div className="stack center">
            <span className="eyebrow">What Ashfaat is</span>
            <h2 style={{ marginTop: 0 }}>A trusted place to give in grief</h2>
            <p className="muted" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
              When someone dies far from home, families often face repatriation
              costs, funeral arrangements, and uncertainty all at once. Ashfaat
              is a calm, verified way for friends and communities to step in —
              every campaign is checked, and every contribution reaches a
              confirmed beneficiary.
            </p>
          </div>
        </Container>
      </section>

      <section className="section" style={{ background: 'var(--surface-2)' }}>
        <Container>
          <div className="stack center" style={{ marginBottom: '2rem' }}>
            <span className="eyebrow">How it works</span>
            <h2 style={{ marginTop: 0 }}>Four simple steps</h2>
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
              <span className="eyebrow">Featured campaigns</span>
              <h2 style={{ margin: 0 }}>Memorial funds you can support</h2>
            </div>
            <Button href="/campaigns" variant="ghost" size="sm">
              View all
            </Button>
          </div>

          {campaigns.length === 0 ? (
            <Card large>
              <div className="stack center">
                <p className="muted" style={{ margin: 0 }}>
                  There are no active campaigns just yet.
                </p>
                <div className="center">
                  <Button href="/start" variant="primary" size="sm">
                    Start the first one
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
              Start a campaign for someone you have lost, or support a family in
              their hardest moment.
            </p>
            <div className="row wrap center" style={{ justifyContent: 'center', marginTop: '0.5rem' }}>
              <Button href="/start" variant="primary">
                Start a campaign
              </Button>
              <Button href="/campaigns" variant="ghost">
                Browse campaigns
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
