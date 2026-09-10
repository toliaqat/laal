import type { ReactNode } from 'react';

/**
 * Pure-CSS recreations of the Laal mobile app screens, for marketing use.
 * No bundled image assets — these render crisp at any scale and stay on-brand.
 * Content mirrors the real app (fundraiser list + detail) in Laal's voice.
 *
 * Every visible string is passed in as {@link MockupCopy} rather than hard-coded:
 * Urdu is the default web locale, so an English screenshot on the Urdu home page
 * would be the first thing most visitors see. The caller (the home page) owns the
 * translations and formats the money with the locale-aware `formatMoney`, so the
 * mockup stays a dumb presentational component.
 */

/** One fundraiser row on the list screen. */
export type MockupCard = {
  title: string;
  /** Person remembered — user-generated in the real app, so it carries `.ugc`. */
  name: string;
  pct: number;
  /** Pre-formatted money strings (the caller owns currency + locale). */
  raised: string;
  goal: string;
};

export type MockupCopy = {
  /** List screen. */
  listTitle: string;
  verified: string;
  lead: string;
  cards: MockupCard[];
  /** Shared labels. */
  inMemoryOf: string;
  /** Renders "of {goal}" — a callback because Urdu puts the number first. */
  ofGoal: (goal: string) => ReactNode;
  raisedLabel: string;
  /** Detail screen. */
  detailTitle: string;
  detailName: string;
  detailRaised: string;
  detailGoal: string;
  detailPct: number;
  story: string;
  /** May carry markup (the family member's name is emphasised). */
  beneficiary: ReactNode;
  cta: string;
  ctaNote: string;
  /** Accessible names for the decorative phones. */
  heroAlt: string;
  showcaseAlt: string;
};

function StatusBar() {
  return (
    <div className="app-status">
      <span className="num">9:41</span>
      <span className="dots" aria-hidden>
        <SignalIcon />
        <WifiIcon />
        <BatteryIcon />
      </span>
    </div>
  );
}

function MiniCard({
  title,
  name,
  pct,
  raised,
  goal,
  inMemoryOf,
  ofGoal,
}: MockupCard & { inMemoryOf: string; ofGoal: (goal: string) => ReactNode }) {
  return (
    <div className="app-card">
      <div className="app-card-title ugc">{title}</div>
      <div className="app-card-mem">
        {inMemoryOf} <span className="ugc">{name}</span>
      </div>
      <div className="app-bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="app-amounts">
        <span className="app-raised num">{raised}</span>
        <span className="app-goal">{ofGoal(goal)}</span>
      </div>
    </div>
  );
}

/** The home / fundraiser list screen. */
export function PhoneListScreen({ copy }: { copy: MockupCopy }) {
  return (
    <div className="phone-screen">
      <div className="phone-notch" aria-hidden />
      <StatusBar />
      <div className="app-body">
        <div className="app-h">
          <span className="app-title ugc">{copy.listTitle}</span>
          {/* plaintext bidi keeps the check glyph attached to the word in RTL */}
          <span className="app-pill ugc">✓ {copy.verified}</span>
        </div>
        <p className="app-sub">{copy.lead}</p>
        {copy.cards.map((card) => (
          <MiniCard
            key={card.title}
            {...card}
            inMemoryOf={copy.inMemoryOf}
            ofGoal={copy.ofGoal}
          />
        ))}
      </div>
    </div>
  );
}

/** The fundraiser detail screen, with the sticky support action. */
export function PhoneDetailScreen({ copy }: { copy: MockupCopy }) {
  return (
    <div className="phone-screen">
      <div className="phone-notch" aria-hidden />
      <StatusBar />
      <div className="app-body" style={{ paddingBottom: '5.5rem' }}>
        <div className="app-h" style={{ marginBottom: '0.1rem' }}>
          <span className="app-title ugc" style={{ fontSize: '1.15rem' }}>
            {copy.detailTitle}
          </span>
        </div>
        <p className="app-sub">
          {copy.inMemoryOf} <span className="ugc">{copy.detailName}</span>
        </p>
        <div className="app-bar">
          <span style={{ width: `${copy.detailPct}%` }} />
        </div>
        <div className="app-amounts">
          <span className="app-raised">
            <span className="num">{copy.detailRaised}</span> {copy.raisedLabel}
          </span>
          <span className="app-goal">{copy.ofGoal(copy.detailGoal)}</span>
        </div>
        <p className="app-story ugc">{copy.story}</p>
        <div className="app-bene ugc">{copy.beneficiary}</div>
      </div>
      <div className="app-cta">
        <span className="app-cta-btn">{copy.cta}</span>
        <p className="app-cta-note">{copy.ctaNote}</p>
      </div>
    </div>
  );
}

/**
 * Two phones — a back-staggered list behind a front detail screen — that float
 * gently. Mirrors how the app actually looks.
 */
export function PhoneShowcase({ copy }: { copy: MockupCopy }) {
  return (
    <div className="phone-stage">
      <div className="phone phone-back phone-floating" aria-hidden>
        <PhoneListScreen copy={copy} />
      </div>
      <div
        className="phone phone-front phone-floating"
        role="img"
        aria-label={copy.showcaseAlt}
      >
        <PhoneDetailScreen copy={copy} />
      </div>
    </div>
  );
}

/** A single floating phone (used in the hero). */
export function PhoneHero({
  copy,
  children,
}: {
  copy: MockupCopy;
  children?: ReactNode;
}) {
  return (
    <div className="phone phone-floating" role="img" aria-label={copy.heroAlt}>
      {children ?? <PhoneListScreen copy={copy} />}
    </div>
  );
}

/* ---- tiny status-bar glyphs ---- */
function SignalIcon() {
  return (
    <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" aria-hidden>
      <rect x="0" y="7" width="2.5" height="4" rx="0.6" />
      <rect x="4" y="4.5" width="2.5" height="6.5" rx="0.6" />
      <rect x="8" y="2" width="2.5" height="9" rx="0.6" />
      <rect x="12" y="0" width="2.5" height="11" rx="0.6" />
    </svg>
  );
}
function WifiIcon() {
  return (
    <svg width="14" height="11" viewBox="0 0 14 11" fill="currentColor" aria-hidden>
      <path d="M7 11l2.4-3a3 3 0 00-4.8 0L7 11z" />
      <path
        d="M1.5 4.2a8 8 0 0111 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function BatteryIcon() {
  return (
    <svg width="22" height="11" viewBox="0 0 22 11" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor" opacity="0.4" />
      <rect x="2" y="2" width="13" height="7" rx="1.3" fill="currentColor" />
      <rect x="20" y="3.5" width="1.5" height="4" rx="0.7" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
