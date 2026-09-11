import type { ReactNode } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Campaign } from '@laal/types';
import { Link } from '@/i18n/navigation';
import { Badge, Card, Progress, formatMoney } from '@/components/ui';
import { MemorialPhoto } from '@/components/memorial-photo';

/**
 * Grid wrapper for fundraiser cards.
 *
 * `.grid-cards` is `auto-fill, minmax(280px, 1fr)`, which stretches a lone card
 * across the full container and leaves a wide dead gutter beside it on desktop.
 * Below three cards we switch to a centred track whose cards are deliberately
 * wider than a three-up card — one fundraiser then reads as a featured card
 * rather than as a mostly-empty page (a 380px cap left ~410px of background on
 * each side at 1280).
 */
export function CampaignGrid({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  const sparse = count > 0 && count < 3;
  const cap = count === 1 ? '640px' : '480px';
  return (
    <div
      className="grid grid-cards"
      style={
        sparse
          ? {
              gridTemplateColumns: `repeat(${count}, minmax(280px, ${cap}))`,
              justifyContent: 'center',
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

/**
 * Shape-only placeholder matching {@link CampaignCard}'s layout, for `loading.tsx`
 * and Suspense fallbacks. `.skeleton` is the shared shimmer utility in
 * app/globals.css; the portrait block reuses the real `.memorial-photo-md` box
 * so the swap to the loaded card does not shift.
 */
export function CampaignCardSkeleton() {
  return (
    <div
      className="card"
      aria-hidden
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div className="row" style={{ alignItems: 'flex-start', gap: '0.9rem' }}>
        <span className="memorial-photo memorial-photo-md skeleton" />
        <div className="stack" style={{ gap: '0.6rem', flex: 1, minWidth: 0 }}>
          <div className="skeleton skeleton-text" style={{ width: '50%' }} />
          <div className="skeleton skeleton-title" style={{ width: '90%' }} />
          <div className="skeleton skeleton-text" style={{ width: '65%' }} />
          <div className="skeleton skeleton-text" style={{ width: '40%' }} />
        </div>
      </div>
      <div className="stack" style={{ gap: '0.6rem', marginBlockStart: 'auto' }}>
        <div className="skeleton" style={{ height: 10, width: '100%' }} />
        <div className="skeleton skeleton-text" style={{ width: '65%' }} />
      </div>
    </div>
  );
}

/** A grid of {@link CampaignCardSkeleton} placeholders. */
export function CampaignCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cards">
      {Array.from({ length: count }, (_, i) => (
        <CampaignCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * The one fundraiser card for every browse surface (the home "featured" strip
 * and the /campaigns list). Built on the shared {@link Card}, {@link Progress}
 * and {@link formatMoney} primitives so it inherits the design tokens, the
 * accessibility work on Progress, and the locale-aware money policy.
 *
 * The header reads like a profile: a 7:9 {@link MemorialPhoto} portrait of
 * their loved one (or a dignified monogram of the deceased's name when the
 * family didn't share a photo) at the inline start, beside the "Fundraiser
 * reviewed" badge, the title and the memorial line. It is a flex row, so under
 * RTL (Urdu is the default web locale) the portrait moves to the right edge
 * with no extra rules.
 */
export async function CampaignCard({ campaign }: { campaign: Campaign }) {
  const [t, tc, ts, locale] = await Promise.all([
    getTranslations('campaigns'),
    getTranslations('common'),
    getTranslations('start'),
    getLocale(),
  ]);

  const pct =
    campaign.goal_amount > 0
      ? (campaign.amount_raised / campaign.goal_amount) * 100
      : 0;

  const city = campaign.death_city?.trim() || null;
  const country = campaign.death_country?.trim() || null;
  const place =
    city && country ? t('card.location', { city, country }) : city ?? country;

  return (
    <Link
      href={`/campaigns/${campaign.slug}`}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        height: '100%',
      }}
    >
      {/* One hover treatment only — `card-hover` via `hover`. Do NOT also apply
          `.story-card`, or the two translateY transforms stack. */}
      <Card
        hover
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div className="row" style={{ alignItems: 'flex-start', gap: '0.9rem' }}>
          {/* The photo is of the person, so the alt names them — not the
              fundraiser title, which a screen reader hears next anyway. */}
          <MemorialPhoto
            size="md"
            name={campaign.deceased_name}
            photoUrl={campaign.cover_image_url}
            alt={ts('cover.photoOfAlt', { name: campaign.deceased_name })}
          />
          <div className="stack" style={{ gap: '0.4rem', flex: 1, minWidth: 0 }}>
            <div>
              <Badge tone="accent">{t('card.reviewed')}</Badge>
            </div>
            <h3 className="ar-flip" style={{ margin: 0, fontSize: '1.1rem' }}>
              {campaign.title}
            </h3>
            <p className="small muted ar-flip" style={{ margin: 0 }}>
              {t('card.inMemoryOf', { name: campaign.deceased_name })}
            </p>
            {place ? (
              <p className="small muted ar-flip" style={{ margin: 0 }}>
                {place}
              </p>
            ) : null}
          </div>
        </div>

        {/* Pinned to the card's foot so amounts line up across a grid row. */}
        <div style={{ marginBlockStart: 'auto' }}>
          <Progress
            value={pct}
            label={tc('progressLabel')}
            underOneLabel={tc('progressUnderOnePercent')}
          />
          {/* One message, two placeholders: hard-coding the raised amount
              before the translated string assumed English word order and put
              the goal first for an Urdu reader — on the page's headline
              number. Each amount is a `<bdi className="num">` so it stays an
              isolated LTR run inside Urdu copy. */}
          <p className="small muted ar-flip" style={{ margin: '0.5rem 0 0' }}>
            {t.rich('card.ofGoal', {
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
                <strong style={{ color: 'var(--ink)' }}>
                  <bdi className="num">{chunks}</bdi>
                </strong>
              ),
              g: (chunks) => <bdi className="num">{chunks}</bdi>,
            })}
          </p>
        </div>
      </Card>
    </Link>
  );
}
