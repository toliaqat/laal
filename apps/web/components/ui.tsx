import type { CSSProperties, ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

/** Shared presentational primitives styled by app/globals.css. */

export function Container({
  children,
  narrow,
  style,
}: {
  children: ReactNode;
  narrow?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div className={`container${narrow ? ' container-narrow' : ''}`} style={style}>
      {children}
    </div>
  );
}

export function Card({
  children,
  hover,
  large,
  style,
}: {
  children: ReactNode;
  hover?: boolean;
  large?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`card${large ? ' card-pad-lg' : ''}${hover ? ' card-hover' : ''}`}
      style={style}
    >
      {children}
    </div>
  );
}

type ButtonVariant = 'primary' | 'ghost' | 'danger';

export function Button({
  children,
  variant = 'primary',
  size,
  block,
  href,
  type = 'button',
  disabled,
  style,
  onClick,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: 'sm';
  block?: boolean;
  href?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  const cls = `btn btn-${variant}${size === 'sm' ? ' btn-sm' : ''}${
    block ? ' btn-block' : ''
  }`;
  if (href && !disabled) {
    return (
      <Link href={href} className={cls} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button
      className={cls}
      type={type}
      disabled={disabled}
      style={style}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'accent';

export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  const suffix = tone === 'default' ? '' : ` badge-${tone}`;
  return <span className={`badge${suffix}`}>{children}</span>;
}

export function Alert({
  tone = 'danger',
  children,
}: {
  tone?: 'danger' | 'success' | 'info';
  children: ReactNode;
}) {
  return (
    <div className={`alert alert-${tone}`} role="alert">
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      {label ? <label className="label">{label}</label> : null}
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

/**
 * A labelled progress bar.
 *
 * Two deliberate behaviours:
 * - A raised amount above zero always keeps a hairline of visible fill
 *   (`max(pct%, 3px)`), so €2 against a €10,000 goal reads as "barely started"
 *   rather than as a broken empty pill. Exactly zero stays genuinely empty.
 * - The bar is never the only signal: the rounded percentage is also rendered
 *   as text. Pass `showPercent={false}` where the surrounding copy already
 *   states it.
 *
 * `label` should be a translated string (`common.progressLabel`); it becomes the
 * accessible name of the progressbar.
 */
export function Progress({
  value,
  label,
  showPercent = true,
}: {
  value: number;
  label?: string;
  showPercent?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const rounded = Math.round(pct);
  return (
    <>
      <div
        className="progress"
        role="progressbar"
        aria-label={label ?? 'Support progress'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
        aria-valuetext={`${rounded}%`}
      >
        <span style={{ width: pct > 0 ? `max(${pct}%, 3px)` : 0 }} />
      </div>
      {showPercent && (
        <span className="progress-value num" style={{ display: 'block' }}>
          {rounded}%
        </span>
      )}
    </>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/**
 * A {@link Stat} that links to a queue where the count can be acted on. Shows a
 * call-to-action cue, emphasised when `count > 0` so pending work stands out.
 */
export function StatLink({
  count,
  label,
  href,
  cta = 'Review',
}: {
  count: number;
  label: string;
  href: string;
  cta?: string;
}) {
  const pending = count > 0;
  return (
    <Link
      href={href}
      className={`stat stat-link${pending ? ' stat-link-pending' : ''}`}
    >
      <div className="stat-value">{count}</div>
      <div className="stat-label">{label}</div>
      <span className="stat-cue">{pending ? `${cta} →` : 'All clear'}</span>
    </Link>
  );
}

export type DonutSegment = { label: string; value: number; color: string };

/**
 * A dependency-free SVG donut chart. Segments are drawn clockwise from 12
 * o'clock; an empty ring is shown when every value is zero. `centerValue` /
 * `centerLabel` render stacked in the hole.
 */
export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  size = 140,
  thickness = 20,
}: {
  segments: DonutSegment[];
  centerValue?: string;
  centerLabel?: string;
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(s.value, 0), 0);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
    >
      <g transform={`rotate(-90 ${c} ${c})`}>
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={thickness}
        />
        {total > 0 &&
          segments.map((seg, i) => {
            const dash = (Math.max(seg.value, 0) / total) * circ;
            const node = (
              <circle
                key={i}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-acc}
              />
            );
            acc += dash;
            return node;
          })}
      </g>
      {centerValue && (
        <text
          x={c}
          y={centerLabel ? c - 4 : c}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontFamily: 'var(--serif)',
            fontSize: '1.4rem',
            fontWeight: 600,
            fill: 'var(--ink)',
          }}
        >
          {centerValue}
        </text>
      )}
      {centerLabel && (
        <text
          x={c}
          y={c + 16}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: '0.7rem', fill: 'var(--muted)' }}
        >
          {centerLabel}
        </text>
      )}
    </svg>
  );
}

/** A labelled, coloured swatch row for a {@link DonutChart} legend. */
export function ChartLegend({
  items,
}: {
  items: { label: string; value: string; color: string }[];
}) {
  return (
    <ul className="chart-legend">
      {items.map((it) => (
        <li key={it.label}>
          <span className="chart-dot" style={{ background: it.color }} />
          <span className="chart-legend-label">{it.label}</span>
          <strong>{it.value}</strong>
        </li>
      ))}
    </ul>
  );
}

/**
 * Format a money amount with its ISO currency, localized to the active locale.
 * Urdu ('ur') keeps Western digits for amounts (clearer for currency) by
 * pinning the numbering system; pass any BCP-47 locale to override.
 */
export function formatMoney(
  amount: number,
  currency: string,
  locale?: string,
): string {
  const resolved = locale === 'ur' ? 'ur-PK-u-nu-latn' : locale;
  try {
    return new Intl.NumberFormat(resolved, {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

/** Map a campaign status to a badge tone. */
export function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'active':
    case 'completed':
      return 'success';
    case 'pending_review':
    case 'paused':
      return 'warning';
    case 'rejected':
    case 'closed':
      return 'danger';
    default:
      return 'default';
  }
}
