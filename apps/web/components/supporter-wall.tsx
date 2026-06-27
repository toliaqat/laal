'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  loadSupporterMessages,
  type SupporterMessage,
} from '@/app/[locale]/campaigns/[slug]/supporters';

/** Fixed locale keeps server and client formatting identical (no hydration mismatch). */
function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function SupporterWall({
  campaignId,
  initialItems,
  initialHasMore,
}: {
  campaignId: string;
  initialItems: SupporterMessage[];
  initialHasMore: boolean;
}) {
  const t = useTranslations('campaigns');
  const [items, setItems] = useState<SupporterMessage[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

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
      <div
        className="stack"
        style={{
          gap: '0.75rem',
          // Scroll once the list gets long; the page stays compact.
          maxHeight: 520,
          overflowY: 'auto',
          paddingRight: '0.25rem',
        }}
      >
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
              <strong>{s.name?.trim() || t('supporters.anonymous')}</strong>
              <span className="muted small">
                {formatAmount(s.amount, s.currency)} · {formatDate(s.createdAt)}
              </span>
            </div>
            <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
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
