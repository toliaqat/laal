'use client';

import { useState } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { formatMoney } from '@/components/ui';
import {
  loadSupporterMessages,
  type SupporterMessage,
} from '@/app/[locale]/campaigns/[slug]/supporters';

/**
 * The wall of messages left by supporters.
 *
 * Formatting notes:
 * - Dates go through next-intl's formatter with an explicit `timeZone`, so the
 *   server render and the client hydration agree (a visitor's local timezone
 *   would otherwise disagree with the UTC server render) and the month name is
 *   localized instead of hard-coded to en-GB.
 * - Amounts reuse {@link formatMoney}, which keeps Western digits for Urdu — the
 *   same treatment money gets everywhere else in the app.
 * - Names and messages are user-generated, so they carry `.ugc` (plaintext
 *   bidi): an English message inside an Urdu page keeps its punctuation on the
 *   correct side.
 */

/** Fixed zone keeps server and client formatting identical (no hydration mismatch). */
const DISPLAY_TIME_ZONE = 'UTC';

export function SupporterWall({
  campaignId,
  initialItems,
  initialHasMore,
  /**
   * Product call: the wall reads as a warm guestbook, not a leaderboard, so
   * exact amounts are hidden by default. Pass `showAmounts` to restore them.
   */
  showAmounts = false,
}: {
  campaignId: string;
  initialItems: SupporterMessage[];
  initialHasMore: boolean;
  showAmounts?: boolean;
}) {
  const t = useTranslations('campaigns');
  const locale = useLocale();
  const format = useFormatter();
  const [items, setItems] = useState<SupporterMessage[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  function formatDate(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return format.dateTime(d, {
      timeZone: DISPLAY_TIME_ZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  async function loadMore() {
    setLoading(true);
    try {
      const next = await loadSupporterMessages(campaignId, items.length);
      setItems((prev) => [...prev, ...next.items]);
      setHasMore(next.hasMore);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack" style={{ gap: '0.75rem' }}>
      {/* No inner scroller: a 520px nested scroll region inside a scrolling
          page is awkward on touch. The "show more" pagination below is the
          only length control. */}
      <div className="stack" style={{ gap: '0.75rem' }}>
        {items.map((s) => (
          <div
            key={s.id}
            className="stack"
            style={{
              gap: '0.35rem',
              borderBottom: '1px solid var(--line)',
              paddingBottom: '0.75rem',
            }}
          >
            <div
              className="row wrap"
              style={{ gap: '0.5rem', alignItems: 'baseline' }}
            >
              <strong className="ugc">
                {s.name?.trim() || t('supporters.anonymous')}
              </strong>
              <span className="muted small">
                {showAmounts && (
                  <>
                    <span className="num">
                      {formatMoney(s.amount, s.currency, locale)}
                    </span>{' '}
                    ·{' '}
                  </>
                )}
                <span className="num">{formatDate(s.createdAt)}</span>
              </span>
            </div>
            <p
              className="ugc"
              style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}
            >
              {s.message}
            </p>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={loadMore}
          disabled={loading}
          style={{ alignSelf: 'center' }}
        >
          {loading ? t('supporters.loading') : t('supporters.showMore')}
        </button>
      )}
    </div>
  );
}
