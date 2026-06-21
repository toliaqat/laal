import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

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
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: 'sm';
  block?: boolean;
  href?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  style?: CSSProperties;
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
    <button className={cls} type={type} disabled={disabled} style={style}>
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

export function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)}>
      <span style={{ width: `${pct}%` }} />
    </div>
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

/** Format a money amount with its ISO currency. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
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
