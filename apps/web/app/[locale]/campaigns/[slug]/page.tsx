import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import type { Campaign, Beneficiary } from '@laal/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { APP_URL } from '@/lib/env';
import { DonateForm } from '@/components/donate-form';
import { SupporterWall } from '@/components/supporter-wall';
import { CampaignUpdates } from '@/components/campaign-updates';
import {
  countSupporterMessages,
  loadSupporterMessages,
} from './supporters';
import { loadCampaignUpdates } from './updates';
import { ShareButtons } from './share-buttons';
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
    return {
      title: t('detail.metaNotFound'),
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
  const format = await getFormatter();
  const campaign = await getCampaign(slug);

  if (!campaign) {
    notFound();
  }

  const beneficiary = await getActiveBeneficiary(campaign.id);

  const [supporterCount, firstSupporters, updates] = await Promise.all([
    countSupporterMessages(campaign.id),
    loadSupporterMessages(campaign.id, 0),
    loadCampaignUpdates(campaign.id),
  ]);

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
          <p className="muted" style={{ margin: 0 }}>
            {t.rich('detail.inMemoryOf', {
              name: () => <strong>{campaign.deceased_name}</strong>,
            })}
            {dates ? ` · ${dates}` : ''}
          </p>
        </div>

        {campaign.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={campaign.cover_image_url}
            alt={campaign.deceased_name}
            className={styles.cover}
          />
        )}

        <Card style={{ margin: '1.5rem 0' }}>
          <div className="stack" style={{ gap: '0.75rem' }}>
            <Progress value={pct} />
            <p style={{ margin: 0 }}>
              <strong style={{ fontSize: '1.15rem' }}>
                {formatMoney(campaign.amount_raised, campaign.currency, locale)}
              </strong>{' '}
              <span className="muted">
                {t('detail.raisedOfGoal', {
                  amount: formatMoney(campaign.goal_amount, campaign.currency, locale),
                })}
              </span>
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

        {beneficiary && (
          <p
            className="small muted"
            style={{
              borderTop: '1px solid var(--line)',
              paddingTop: '1rem',
            }}
          >
            {t.rich('detail.supportReaches', {
              name: () => <strong>{beneficiary.display_name}</strong>,
            })}
            {beneficiary.relationship_to_deceased
              ? ` (${beneficiary.relationship_to_deceased})`
              : ''}
            .
          </p>
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

        {accepting && (
          <div className={styles.stickyHelp}>
            <a href="#help" className="btn btn-primary btn-block">
              {t('detail.helpNow')}
            </a>
          </div>
        )}
      </Container>
    </main>
  );
}
