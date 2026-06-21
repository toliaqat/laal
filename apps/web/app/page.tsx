import Link from 'next/link';
import type { Campaign } from '@laal/types';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  Container,
  Card,
  Button,
  Progress,
  formatMoney,
} from '@/components/ui';
import { PhoneHero, PhoneShowcase } from '@/components/phone-mockup';

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
    title: 'Start a fundraiser',
    body: 'A friend, colleague, or family member shares someone’s story in minutes.',
  },
  {
    title: 'Every need is verified',
    body: 'Our team gently confirms the people and the need before anything moves.',
  },
  {
    title: 'Give with confidence',
    body: 'Supporters contribute securely — no account required to help.',
  },
  {
    title: 'Support reaches the family',
    body: 'Your contribution reaches a confirmed family member or trusted partner.',
  },
];

const VALUES = [
  {
    icon: <ShieldIcon />,
    title: 'Every fundraiser is reviewed',
    body: 'We verify the people and the need before any support is given.',
  },
  {
    icon: <HeartIcon />,
    title: 'Kindness reaches the family',
    body: 'Funds go to a confirmed family member or trusted partner — never a stranger.',
  },
  {
    icon: <LockIcon />,
    title: 'Secure and transparent',
    body: 'Give safely in seconds. You always see where support is going.',
  },
];

const APP_FEATURES = [
  'Browse verified fundraisers from your community',
  'Follow a family’s journey and see support arrive',
  'Help in seconds — securely, no account needed',
];

export default async function HomePage() {
  const campaigns = await getFeaturedCampaigns();

  return (
    <main>
      {/* ---------- Hero ---------- */}
      <section className="hero-lux">
        <Container>
          <div className="hero-grid">
            <div className="hero-copy stack" style={{ gap: '1.1rem' }}>
              <span className="eyebrow reveal" style={{ animationDelay: '0.05s' }}>
                Every life is precious
              </span>
              <h1 className="reveal" style={{ animationDelay: '0.12s', margin: 0 }}>
                Everyone is someone’s{' '}
                <span className="ink-gradient">Laal</span>.
              </h1>
              <p
                className="muted reveal"
                style={{
                  animationDelay: '0.2s',
                  fontSize: '1.15rem',
                  lineHeight: 1.7,
                  maxWidth: '44ch',
                  margin: 0,
                }}
              >
                A mother. A father. A child. A dream. Behind every request is a
                person who matters — and a community ready to stand with them.
              </p>
              <div
                className="row wrap reveal"
                style={{ animationDelay: '0.28s', marginTop: '0.25rem' }}
              >
                <Button href="/start" variant="primary">
                  Support Someone Today
                </Button>
                <Button href="/campaigns" variant="ghost">
                  Browse fundraisers
                </Button>
              </div>
              <div
                className="trust-line reveal"
                style={{ animationDelay: '0.36s', marginTop: '0.75rem' }}
              >
                <span className="trust-item">
                  <ShieldIcon /> Every fundraiser verified
                </span>
                <span className="trust-item">
                  <HeartIcon /> Reaches the family
                </span>
                <span className="trust-item">
                  <LockIcon /> Secure giving
                </span>
              </div>
            </div>

            <div className="hero-art reveal-soft" style={{ animationDelay: '0.3s' }}>
              <PhoneHero />
            </div>
          </div>
        </Container>
      </section>

      {/* ---------- Value band ---------- */}
      <section className="value-band section" style={{ padding: '2.5rem 0' }}>
        <Container>
          <div className="value-grid">
            {VALUES.map((v) => (
              <div key={v.title} className="value-item">
                <span className="value-icon" aria-hidden>
                  {v.icon}
                </span>
                <div>
                  <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.05rem' }}>
                    {v.title}
                  </h3>
                  <p className="small muted" style={{ margin: 0 }}>
                    {v.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ---------- What Laal is ---------- */}
      <section className="section">
        <Container narrow>
          <div className="stack center">
            <span className="eyebrow">What Laal is</span>
            <h2 style={{ marginTop: 0 }}>A warm, trusted place to help</h2>
            <p className="muted" style={{ fontSize: '1.05rem', lineHeight: 1.8 }}>
              When a family faces a hard moment, they often carry costs, worry,
              and uncertainty all at once. Laal is a calm, caring way for friends
              and community to step in — every fundraiser is gently verified, and
              every act of kindness reaches the family who needs it.
            </p>
          </div>
        </Container>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="section" style={{ background: 'var(--surface-2)' }}>
        <Container>
          <div className="stack center" style={{ marginBottom: '2.25rem' }}>
            <span className="eyebrow">How it works</span>
            <h2 style={{ marginTop: 0 }}>Four gentle steps</h2>
          </div>
          <div className="grid grid-cards">
            {STEPS.map((step, i) => (
              <Card key={step.title} hover>
                <div className="step-card">
                  <div className="stack" style={{ gap: '0.6rem' }}>
                    <span className="step-num">{i + 1}</span>
                    <h3 style={{ margin: 0 }}>{step.title}</h3>
                    <p className="muted" style={{ margin: 0 }}>
                      {step.body}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* ---------- App showcase ---------- */}
      <section className="showcase section">
        <Container>
          <div className="showcase-grid">
            <div className="stack" style={{ gap: '0.5rem' }}>
              <span className="eyebrow">Laal in your pocket</span>
              <h2 style={{ marginTop: 0 }}>Carry their stories with you</h2>
              <p className="muted" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
                The Laal app keeps you close to the people your community is
                standing with. Follow a family’s journey, and be there the moment
                they need you — wherever you are.
              </p>
              <div className="feature-list">
                {APP_FEATURES.map((f) => (
                  <div key={f} className="feature-item">
                    <span className="feature-check" aria-hidden>
                      <CheckIcon />
                    </span>
                    <span style={{ color: 'var(--ink-soft)' }}>{f}</span>
                  </div>
                ))}
              </div>
              <div className="row wrap">
                <Button href="/campaigns" variant="primary">
                  Explore fundraisers
                </Button>
                <span className="trust-pill">
                  <SparkIcon /> iOS &amp; Android — coming soon
                </span>
              </div>
            </div>

            <PhoneShowcase />
          </div>
        </Container>
      </section>

      {/* ---------- Featured stories ---------- */}
      <section className="section">
        <Container>
          <div className="row-between wrap" style={{ marginBottom: '1.75rem' }}>
            <div className="stack" style={{ gap: '0.25rem' }}>
              <span className="eyebrow">Featured fundraisers</span>
              <h2 style={{ margin: 0 }}>Fundraisers you can support</h2>
            </div>
            <Button href="/campaigns" variant="ghost" size="sm">
              View all
            </Button>
          </div>

          {campaigns.length === 0 ? (
            <Card large>
              <div className="stack center">
                <p className="muted" style={{ margin: 0 }}>
                  New fundraisers are being reviewed. Check back soon to support
                  someone precious.
                </p>
                <div className="center">
                  <Button href="/start" variant="primary" size="sm">
                    Start the first fundraiser
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
                      <div className="story-card">
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
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </Container>
      </section>

      {/* ---------- Closing CTA ---------- */}
      <section className="cta-lux section">
        <Container narrow>
          <div className="stack center">
            <span className="eyebrow">Stand with someone</span>
            <h2 style={{ marginTop: 0 }}>Be there when it matters most</h2>
            <p className="muted" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
              Share the story of someone you care about, or stand with a family
              in their hardest moment. Small kindness, life-changing impact.
            </p>
            <div
              className="row wrap center"
              style={{ justifyContent: 'center', marginTop: '0.5rem' }}
            >
              <Button href="/start" variant="primary">
                Support Someone Today
              </Button>
              <Button href="/campaigns" variant="ghost">
                Browse fundraisers
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}

/* ---------- inline icons (stroke = currentColor) ---------- */
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 8.3-7 9.5C8 19.3 5 15.5 5 11V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.8 6.6a5 5 0 00-7.1 0L12 8.3l-1.7-1.7a5 5 0 00-7.1 7.1l1.7 1.7L12 22l7.1-6.6 1.7-1.7a5 5 0 000-7.1z" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
      <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12l4 4L19 7" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2z" />
    </svg>
  );
}
