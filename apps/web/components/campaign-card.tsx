import type { ReactNode } from 'react';
import Image from 'next/image';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Campaign } from '@laal/types';
import { Link } from '@/i18n/navigation';
import { Badge, Card, Progress, formatMoney } from '@/components/ui';

/**
 * Grid wrapper for fundraiser cards.
 *
 * `.grid-cards` is `auto-fill, minmax(280px, 1fr)`, which stretches a lone card
 * across the full container and leaves a wide dead gutter beside it on desktop.
 * Below three cards we switch to a centred, width-capped track instead.
 */
export function CampaignGrid({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  const sparse = count > 0 && count < 3;
  return (
    <div
      className="grid grid-cards"
      style={
        sparse
          ? {
              gridTemplateColumns: `repeat(${count}, minmax(280px, 380px))`,
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
 * app/globals.css.
 */
export function CampaignCardSkeleton() {
  return (
    <div
      className="card"
      aria-hidden
      style={{ padding: 0, overflow: 'hidden', height: '100%' }}
    >
      <div
        className="skeleton"
        style={{
          aspectRatio: '16 / 10',
          width: '100%',
          borderRadius: 0,
        }}
      />
      <div className="stack" style={{ gap: '0.6rem', padding: '1.25rem' }}>
        <div className="skeleton skeleton-title" style={{ width: '85%' }} />
        <div className="skeleton skeleton-text" style={{ width: '55%' }} />
        <div className="skeleton skeleton-text" style={{ width: '40%' }} />
        <div
          className="skeleton"
          style={{ height: 10, width: '100%', marginBlockStart: '0.4rem' }}
        />
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
 * Up-to-two-letter monogram for the memorial fallback banner. Mirrors
 * `initials()` in apps/mobile/lib/theme.ts so both surfaces read the same.
 */
function monogram(name: string): string {
  const [first, second] = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!first) return '·';
  if (second) return (first[0]! + second[0]!).toLocaleUpperCase();
  return first.slice(0, 2).toLocaleUpperCase();
}

/**
 * The one fundraiser card for every browse surface (the home "featured" strip
 * and the /campaigns list). Built on the shared {@link Card}, {@link Progress}
 * and {@link formatMoney} primitives so it inherits the design tokens, the
 * accessibility work on Progress, and the locale-aware money policy.
 *
 * Treatment is ported from the mobile card: a cover photo when the family
 * shared one, a dignified monogram of the deceased's name when they didn't, and
 * a "Fundraiser reviewed" badge floated over the banner using logical inset
 * properties so it mirrors under RTL (Urdu is the default web locale).
 */
export async function CampaignCard({ campaign }: { campaign: Campaign }) {
  const [t, tc, locale] = await Promise.all([
    getTranslations('campaigns'),
    getTranslations('common'),
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
          padding: 0,
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            position: 'relative',
            aspectRatio: '16 / 10',
            width: '100%',
            background: 'var(--accent-soft)',
            borderBlockEnd: '1px solid var(--line)',
          }}
        >
          {campaign.cover_image_url ? (
            <Image
              src={campaign.cover_image_url}
              alt={t('card.coverAlt', { title: campaign.title })}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 360px"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--serif)',
                fontSize: 'clamp(2.5rem, 7vw, 3.25rem)',
                fontWeight: 600,
                color: 'var(--accent)',
                opacity: 0.55,
                letterSpacing: '0.04em',
              }}
            >
              {monogram(campaign.deceased_name)}
            </span>
          )}

          {/* Logical inset → flips to the right edge under RTL. */}
          <span
            style={{
              position: 'absolute',
              top: '0.75rem',
              insetInlineStart: '0.75rem',
            }}
          >
            <Badge tone="accent">{t('card.reviewed')}</Badge>
          </span>
        </div>

        <div
          className="stack"
          style={{ gap: '0.5rem', padding: '1.25rem', flex: 1 }}
        >
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

          <div style={{ marginBlockStart: 'auto', paddingBlockStart: '0.5rem' }}>
            <Progress value={pct} label={tc('progressLabel')} />
            <p className="small" style={{ margin: '0.5rem 0 0' }}>
              <strong>
                {formatMoney(campaign.amount_raised, campaign.currency, locale)}
              </strong>{' '}
              <span className="muted">
                {t('card.ofGoal', {
                  amount: formatMoney(
                    campaign.goal_amount,
                    campaign.currency,
                    locale,
                  ),
                })}
              </span>
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
