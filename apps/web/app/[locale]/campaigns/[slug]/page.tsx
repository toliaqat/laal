import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import type { Campaign } from '@laal/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { APP_URL } from '@/lib/env';
import {
  beneficiaryName,
  deathVerifierType,
  startedBy,
  trustBadges,
} from '@/lib/campaign-trust';
import { DonateForm } from '@/components/donate-form';
import { SupporterWall } from '@/components/supporter-wall';
import { CampaignUpdates } from '@/components/campaign-updates';
import { MemorialPhoto } from '@/components/memorial-photo';
import {
  countSupporterMessages,
  loadSupporterMessages,
} from './supporters';
import { loadCampaignUpdates } from './updates';
import { loadCampaignTrustForViewer } from './trust';
import { ShareButtons } from './share-buttons';
import { StickyHelp } from './sticky-help';
import styles from './campaign.module.css';
import { Container, Card, Progress, Badge, formatMoney } from '@/components/ui';

type Params = { slug: string; locale: string };

async function getCampaign(slug: string): Promise<Campaign | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('campaigns')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return (data as Campaign | null) ?? null;
}

/**
 * Badge tone per trust state. "Fundraiser reviewed" is deliberately the neutral
 * tone: it means a human read the fundraiser, not that anything is verified —
 * only the two verification states earn the green.
 */
const TRUST_TONES = {
  reviewed: 'default',
  needVerified: 'success',
  familyVerified: 'success',
} as const;

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Copy for a fundraiser that isn't taking support right now. Each state gets a
 * calm, specific card instead of the donate form (and `closed` is deliberately
 * neutral — it is not an error).
 */
function stateKeys(status: Campaign['status']): {
  title: string;
  body: string;
} {
  switch (status) {
    case 'completed':
      return {
        title: 'detail.state.completedTitle',
        body: 'detail.state.completedBody',
      };
    case 'closed':
      return {
        title: 'detail.state.closedTitle',
        body: 'detail.state.closedBody',
      };
    // Kept, but only the organizer and admins can now reach a paused page:
    // 'paused' is not in PUBLIC_CAMPAIGN_STATUSES (lib/campaign-auth.ts) because
    // pausing is the platform's takedown lever, so RLS 404s it for everyone
    // else. See the long note in 0013_public_trust_projection.sql.
    case 'paused':
      return {
        title: 'detail.state.pausedTitle',
        body: 'detail.state.pausedBody',
      };
    default:
      // draft / pending_review / rejected — only the organizer can reach these.
      return {
        title: 'detail.state.notLiveTitle',
        body: 'detail.state.notLiveBody',
      };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'campaigns' });
  const campaign = await getCampaign(slug);

  if (!campaign) {
    // A missing fundraiser still answers 200 (the framework drops the status
    // that `notFound()` sets on a dynamically rendered route — see the note in
    // the page component), so the only thing standing between a dead
    // fundraiser URL and a search result is this directive. Keep it.
    return {
      title: t('detail.metaNotFound'),
      robots: { index: false, follow: true },
    };
  }

  const title = t('detail.metaTitle', { title: campaign.title });
  const description =
    campaign.story?.slice(0, 200) ??
    t('detail.metaDescription', { name: campaign.deceased_name });
  const url = `${APP_URL()}/${locale}/campaigns/${campaign.slug}`;

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
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('campaigns');
  const tc = await getTranslations('common');
  const ts = await getTranslations('start');
  const format = await getFormatter();
  const campaign = await getCampaign(slug);

  if (!campaign) {
    // NOTE: this renders the 404 body, but the response still carries HTTP 200.
    // Verified on a production build (`next build` + `next start`), and it is
    // not ours: a page that does nothing but call `notFound()` synchronously
    // answers 200 too, with the route's loading boundary, the locale
    // `not-found.tsx`, the middleware and the Sentry wrapper each removed in
    // turn. Next 15.5.19 loses the status for a dynamically rendered route
    // under the `[locale]` root layout. Until that is fixed upstream, the
    // `robots: noindex` in generateMetadata above is what keeps dead fundraiser
    // URLs out of search results.
    notFound();
  }

  const [supporterCount, firstSupporters, updates, trust] = await Promise.all([
    countSupporterMessages(campaign.id),
    loadSupporterMessages(campaign.id, 0),
    loadCampaignUpdates(campaign.id),
    // Viewer-aware: the public projection for a supporter, and — because the
    // projection has no owner branch — an RLS-scoped read of the base tables so
    // an organizer previewing a draft/pending/paused fundraiser still sees who
    // the support reaches. Nothing anonymous is widened.
    loadCampaignTrustForViewer(campaign.id),
  ]);

  // What we may honestly claim about this fundraiser, and who support reaches.
  // All of it comes from the public trust projection — the beneficiary and
  // verification tables themselves are invisible to a supporter under RLS.
  const badges = trustBadges(trust);
  const verifier = deathVerifierType(trust);
  const reaches = beneficiaryName(trust);
  const starter = startedBy(trust);

  // Locale-aware: the deceased's dates used to be hard-coded to en-GB, which
  // rendered Latin months on the Urdu page.
  const formatDate = (value: string | null): string | null => {
    const d = toDate(value);
    return d ? format.dateTime(d, { dateStyle: 'medium' }) : null;
  };
  const dob = formatDate(campaign.deceased_dob);
  const dod = formatDate(campaign.deceased_dod);
  const dates =
    dob && dod
      ? `${dob} – ${dod}`
      : dod
        ? t('detail.died', { date: dod })
        : dob
          ? t('detail.born', { date: dob })
          : null;

  const pct = campaign.goal_amount
    ? (campaign.amount_raised / campaign.goal_amount) * 100
    : 0;

  // Only an active fundraiser can take support. Everything else gets a calm
  // status card — and the Help Now anchors, which point into the donate form,
  // are hidden with it.
  const accepting = campaign.status === 'active';
  const shareUrl = `${APP_URL()}/${locale}/campaigns/${campaign.slug}`;
  const state = stateKeys(campaign.status);

  return (
    <main className="section">
      <Container narrow>
        {/* A 7:9 portrait of their loved one beside the title and memorial
            line (above them on phones) — a person, not a hero banner. Only
            when the family shared a photo: this page already names them
            prominently, so there is no monogram stand-in here. Without a photo
            the wrapper is a plain block and the header is exactly as before. */}
        <div className={campaign.cover_image_url ? styles.header : undefined}>
          {campaign.cover_image_url ? (
            <MemorialPhoto
              size="lg"
              name={campaign.deceased_name}
              photoUrl={campaign.cover_image_url}
              alt={ts('cover.photoOfAlt', { name: campaign.deceased_name })}
              priority
            />
          ) : null}
          <div className="stack" style={{ gap: '0.4rem' }}>
            <div className="row wrap">
              <span className="eyebrow">{t('detail.eyebrow')}</span>
              {campaign.status === 'completed' ? (
                <Badge tone="success">{t('detail.goalReached')}</Badge>
              ) : campaign.status === 'closed' ? (
                // Neutral, not `danger`: a closed fundraiser is not a failure.
                <Badge>{t('detail.closed')}</Badge>
              ) : campaign.status === 'paused' ? (
                <Badge tone="warning">{t('detail.paused')}</Badge>
              ) : null}
            </div>
            <h1 className={styles.title}>{campaign.title}</h1>

            {/* The trust promise, directly under the title — it is the reason a
                supporter can give to a stranger's fundraiser at all. Each badge
                is one proven fact; nothing here is rendered on hope. */}
            {badges.length > 0 && (
              <div
                className="row wrap"
                style={{ gap: '0.4rem' }}
                // role + label: without a role the label is not exposed, and a
                // bare run of badges tells a screen-reader user nothing about
                // what they are.
                role="group"
                aria-label={t('detail.trust.heading')}
              >
                {badges.map((badge) => (
                  <Badge key={badge} tone={TRUST_TONES[badge]}>
                    {t(`detail.trust.${badge}`)}
                  </Badge>
                ))}
              </div>
            )}

            <p className="muted" style={{ margin: 0 }}>
              {t.rich('detail.inMemoryOf', {
                name: () => <strong className="ugc">{campaign.deceased_name}</strong>,
              })}
              {dates ? ` · ${dates}` : ''}
            </p>

            {/* Who the money reaches, who confirmed the need, and who started the
                fundraiser — kept together with the badges instead of floating as
                muted small print at the bottom of the page, which is where the
                "your support reaches X" line used to sit (and where it silently
                rendered empty for everyone but the organizer). */}
            {(reaches || verifier || starter) && (
              <div className={styles.trust}>
                {reaches && (
                  <p style={{ margin: 0 }}>
                    {t.rich('detail.supportReaches', {
                      name: () => <strong className="ugc">{reaches}</strong>,
                    })}
                    {/* The relationship is no longer repeated here: it is the
                        same column as `organizer_relationship`, rendered once
                        below in "Started by Ahmed, brother" where it is
                        grammatical — and 0013 no longer projects it twice. */}
                    .
                  </p>
                )}
                {verifier && (
                  <p className="small muted" style={{ margin: 0 }}>
                    {t('detail.trust.confirmedWith', {
                      verifier: t(`detail.trust.verifier.${verifier}`),
                    })}
                  </p>
                )}
                {starter && (
                  <p className="small muted" style={{ margin: 0 }}>
                    {starter.relationship
                      ? t.rich('detail.startedByWithRelationship', {
                          name: () => <span className="ugc">{starter.name}</span>,
                          relationship: () => (
                            <span className="ugc">{starter.relationship}</span>
                          ),
                        })
                      : t.rich('detail.startedBy', {
                          name: () => <span className="ugc">{starter.name}</span>,
                        })}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <Card style={{ margin: '1.5rem 0' }}>
          <div className="stack" style={{ gap: '0.75rem' }}>
            {/* The label is the progressbar's accessible name — without it the
                component falls back to a hard-coded English string, which is
                wrong on the Urdu default locale. */}
            <Progress
              value={pct}
              label={tc('progressLabel')}
              underOneLabel={tc('progressUnderOnePercent')}
            />
            {/* The headline number on the page, so its reading order matters:
                the raised amount used to be hard-coded BEFORE the translated
                string, an English word-order assumption that put the goal first
                and the raised figure last for an Urdu (RTL) reader. Both
                amounts are placeholders in one message now, each wrapped in a
                `<bdi className="num">` so it stays an isolated LTR run. */}
            <p className="muted" style={{ margin: 0 }}>
              {t.rich('detail.raisedOfGoal', {
                raised: formatMoney(
                  campaign.amount_raised,
                  campaign.currency,
                  locale,
                ),
                goal: formatMoney(
                  campaign.goal_amount,
                  campaign.currency,
                  locale,
                ),
                r: (chunks) => (
                  <strong style={{ fontSize: '1.15rem', color: 'var(--ink)' }}>
                    <bdi className="num">{chunks}</bdi>
                  </strong>
                ),
                g: (chunks) => <bdi className="num">{chunks}</bdi>,
              })}
            </p>
            {accepting && (
              // Plain anchor, not the locale-aware Link: this is an in-page jump
              // to the donate form so the CTA is reachable from the first screen.
              <div>
                <a href="#help" className="btn btn-primary">
                  {t('detail.helpNow')}
                </a>
              </div>
            )}
            <ShareButtons url={shareUrl} title={campaign.title} />
          </div>
        </Card>

        {campaign.story && (
          <section className={styles.storySection}>
            <h2>{t('detail.storyHeading')}</h2>
            <p className={styles.story}>{campaign.story}</p>
          </section>
        )}

        <CampaignUpdates items={updates.items} hasMore={updates.hasMore} />

        {supporterCount > 0 && (
          <section style={{ margin: '2rem 0' }}>
            <h2 style={{ marginBottom: '1rem' }}>
              {t('detail.wordsOfSupport')}{' '}
              <span className="muted" style={{ fontWeight: 400 }}>
                ({supporterCount})
              </span>
            </h2>
            <Card>
              <SupporterWall
                campaignId={campaign.id}
                initialItems={firstSupporters.items}
                initialHasMore={firstSupporters.hasMore}
              />
            </Card>
          </section>
        )}

        <Card large style={{ marginTop: '2rem' }}>
          {accepting ? (
            <DonateForm
              campaignId={campaign.id}
              slug={campaign.slug}
              currency={campaign.currency}
              campaignTitle={campaign.title}
            />
          ) : (
            <div className="stack" style={{ gap: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>{t(state.title)}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {t(state.body)}
              </p>
            </div>
          )}
        </Card>

        {accepting && <StickyHelp label={t('detail.helpNow')} />}
      </Container>
    </main>
  );
}
