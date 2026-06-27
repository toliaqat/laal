import type { CSSProperties } from 'react';
import { getTranslations } from 'next-intl/server';

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

export async function ProgressBar({
  raised,
  goal,
  currency,
  style,
}: {
  raised: number;
  goal: number;
  currency: string;
  style?: CSSProperties;
}) {
  const t = await getTranslations('campaigns');
  const pct =
    goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

  return (
    <div style={style}>
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: '#eee',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: '#1a1a1a',
            borderRadius: 999,
          }}
        />
      </div>
      <p
        style={{
          margin: '0.5rem 0 0',
          fontSize: '0.875rem',
          color: '#555',
        }}
      >
        <strong style={{ color: '#1a1a1a' }}>
          {formatMoney(raised, currency)}
        </strong>{' '}
        {t('progress.raisedOfGoal', { amount: formatMoney(goal, currency) })}
      </p>
    </div>
  );
}
