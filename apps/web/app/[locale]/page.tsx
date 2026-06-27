import Image from 'next/image';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Campaign } from '@laal/types';
import { Link } from '@/i18n/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  Container,
  Card,
  Button,
  Progress,
  formatMoney,
} from '@/components/ui';
import { PhoneHero, PhoneShowcase } from '@/components/phone-mockup';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home.meta' });
  return { title: t('title'), description: t('description') };
}

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

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tc = await getTranslations('common');
  const campaigns = await getFeaturedCampaigns();

  const steps = [
    { title: t('steps.startTitle'), body: t('steps.startBody') },
    { title: t('steps.verifyTitle'), body: t('steps.verifyBody') },
    { title: t('steps.giveTitle'), body: t('steps.giveBody') },
    { title: t('steps.reachTitle'), body: t('steps.reachBody') },
  ];

  const values = [
    { icon: <ShieldIcon />, title: t('values.reviewedTitle'), body: t('values.reviewedBody') },
    { icon: <HeartIcon />, title: t('values.kindnessTitle'), body: t('values.kindnessBody') },
    { icon: <LockIcon />, title: t('values.secureTitle'), body: t('values.secureBody') },
  ];

  const appFeatures = [t('showcase.feature1'), t('showcase.feature2'), t('showcase.feature3')];

  return (
    <main>
      {/* ---------- Hero ---------- */}
      <section className="hero-lux">
        <Container>
          <div className="hero-grid">
            <div className="hero-copy stack" style={{ gap: '1.1rem' }}>
              <span className="eyebrow reveal" style={{ animationDelay: '0.05s' }}>
                {t('hero.eyebrow')}
              </span>
              <h1 className="reveal" style={{ animationDelay: '0.12s', margin: 0 }}>
                {t.rich('hero.title', {
                  laal: (chunks) => <span className="ink-gradient">{chunks}</span>,
                })}
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
                {t('hero.lead')}
              </p>
              <div
                className="row wrap reveal"
                style={{ animationDelay: '0.28s', marginTop: '0.25rem' }}
              >
                <Button href="/start" variant="primary">
                  {t('hero.ctaPrimary')}
                </Button>
                <Button href="/campaigns" variant="ghost">
                  {t('hero.ctaBrowse')}
                </Button>
              </div>
              <div
                className="trust-line reveal"
                style={{ animationDelay: '0.36s', marginTop: '0.75rem' }}
              >
                <span className="trust-item">
                  <ShieldIcon /> {t('hero.trustVerified')}
                </span>
                <span className="trust-item">
                  <HeartIcon /> {t('hero.trustReaches')}
                </span>
                <span className="trust-item">
                  <LockIcon /> {t('hero.trustSecure')}
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
            {values.map((v) => (
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
        <Container>
          <div className="split-band">
            <div className="split-media reveal-soft">
              <Image
                src="/family-warmth.jpg"
                alt={t('what.imageAlt')}
                fill
                sizes="(max-width: 880px) 100vw, 50vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <div className="stack" style={{ gap: '0.6rem' }}>
              <span className="eyebrow">{t('what.eyebrow')}</span>
              <h2 style={{ marginTop: 0 }}>{t('what.title')}</h2>
              <p className="muted" style={{ fontSize: '1.05rem', lineHeight: 1.8 }}>
                {t('what.body')}
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="section" style={{ background: 'var(--surface-2)' }}>
        <Container>
          <div className="stack center" style={{ marginBottom: '1.75rem' }}>
            <span className="eyebrow">{t('how.eyebrow')}</span>
            <h2 style={{ marginTop: 0 }}>{t('how.title')}</h2>
          </div>
          <div className="band-media reveal-soft" style={{ marginBottom: '2.25rem' }}>
            <Image
              src="/family-generations.jpg"
              alt={t('how.imageAlt')}
              fill
              sizes="(max-width: 1080px) 100vw, 1080px"
              style={{ objectFit: 'cover', objectPosition: 'center 35%' }}
            />
          </div>
          <div className="grid grid-cards">
            {steps.map((step, i) => (
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
              <span className="eyebrow">{t('showcase.eyebrow')}</span>
              <h2 style={{ marginTop: 0 }}>{t('showcase.title')}</h2>
              <p className="muted" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
                {t('showcase.body')}
              </p>
              <div className="feature-list">
                {appFeatures.map((f) => (
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
                  {t('showcase.cta')}
                </Button>
                <span className="trust-pill">
                  <SparkIcon /> {t('showcase.comingSoon')}
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
              <span className="eyebrow">{t('featured.eyebrow')}</span>
              <h2 style={{ margin: 0 }}>{t('featured.title')}</h2>
            </div>
            <Button href="/campaigns" variant="ghost" size="sm">
              {tc('viewAll')}
            </Button>
          </div>

          {campaigns.length === 0 ? (
            <Card large>
              <div className="stack center">
                <p className="muted" style={{ margin: 0 }}>
                  {t('featured.emptyBody')}
                </p>
                <div className="center">
                  <Button href="/start" variant="primary" size="sm">
                    {t('featured.emptyCta')}
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
                            {t('featured.inMemoryOf', { name: c.deceased_name })}
                          </p>
                          <Progress value={pct} />
                          <p className="small" style={{ margin: 0 }}>
                            <strong>
                              {formatMoney(c.amount_raised, c.currency, locale)}
                            </strong>{' '}
                            <span className="muted">
                              {t('featured.raisedOf', {
                                amount: formatMoney(c.goal_amount, c.currency, locale),
                              })}
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
        <Container>
          <div className="cta-grid">
            <div className="cta-media reveal-soft">
              <Image
                src="/reaching-hands.jpg"
                alt={t('cta.imageAlt')}
                fill
                sizes="(max-width: 880px) 100vw, 42vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <div className="stack" style={{ gap: '0.6rem' }}>
              <span className="eyebrow">{t('cta.eyebrow')}</span>
              <h2 style={{ marginTop: 0 }}>{t('cta.title')}</h2>
              <p className="muted" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
                {t('cta.body')}
              </p>
              <div className="row wrap" style={{ marginTop: '0.5rem' }}>
                <Button href="/start" variant="primary">
                  {t('cta.ctaPrimary')}
                </Button>
                <Button href="/campaigns" variant="ghost">
                  {t('cta.ctaBrowse')}
                </Button>
              </div>
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
