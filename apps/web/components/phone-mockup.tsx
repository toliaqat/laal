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

/**
 * Which illustrated portrait a mockup card shows. These are drawings, never
 * photos: a stock photo of a real, identifiable person on a card captioned
 * "In memory of …" would present a living stranger as someone who has died.
 * If you have photos you are cleared to use that way, pass `photoUrl` instead.
 */
export type PortraitVariant = 'short-hair' | 'beard' | 'headscarf';

/** One fundraiser row on the list screen. */
export type MockupCard = {
  title: string;
  /** Person remembered — user-generated in the real app, so it carries `.ugc`. */
  name: string;
  portrait: PortraitVariant;
  /** Optional real photo; only use one you have explicit permission to show this way. */
  photoUrl?: string;
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
  detailPortrait: PortraitVariant;
  detailPhotoUrl?: string;
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
  portrait,
  photoUrl,
  pct,
  raised,
  goal,
  inMemoryOf,
  ofGoal,
}: MockupCard & { inMemoryOf: string; ofGoal: (goal: string) => ReactNode }) {
  return (
    <div className="app-card">
      {/* Flex rows follow the document direction, so the portrait sits at the
          inline start: left in English, right in Urdu. */}
      <div style={portraitRow}>
        <Portrait variant={portrait} photoUrl={photoUrl} width={34} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="app-card-title ugc">{title}</div>
          <div className="app-card-mem">
            {inMemoryOf} <span className="ugc">{name}</span>
          </div>
        </div>
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
        <div style={{ ...portraitRow, marginBottom: '0.7rem' }}>
          <Portrait
            variant={copy.detailPortrait}
            photoUrl={copy.detailPhotoUrl}
            width={46}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="app-h" style={{ marginBottom: '0.1rem' }}>
              <span className="app-title ugc" style={{ fontSize: '1.15rem' }}>
                {copy.detailTitle}
              </span>
            </div>
            <p className="app-sub" style={{ margin: 0 }}>
              {copy.inMemoryOf} <span className="ugc">{copy.detailName}</span>
            </p>
          </div>
        </div>
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

const portraitRow = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.6rem',
  marginBottom: '0.55rem',
} as const;

/**
 * A passport-style 7:9 portrait for a mockup card — the same shape the real app
 * uses for the person's photo — drawn as a soft head-and-shoulders figure in the
 * brand's warm tones. Decorative (`aria-hidden`): each phone has an accessible name.
 */
function Portrait({
  variant,
  photoUrl,
  width,
}: {
  variant: PortraitVariant;
  photoUrl?: string;
  /** Height follows from the 7:9 passport ratio. */
  width: number;
}) {
  const height = Math.round((width * 9) / 7);
  const frame = {
    width,
    height,
    flex: 'none',
    borderRadius: Math.round(width * 0.18),
    overflow: 'hidden',
    border: '1.5px solid var(--surface)',
    boxShadow: '0 0 0 1px var(--line)',
    background: 'var(--accent-soft)',
  } as const;

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- decorative marketing art
      <img src={photoUrl} alt="" aria-hidden width={width} height={height} style={{ ...frame, objectFit: 'cover' }} />
    );
  }

  const skin = 'var(--accent)';
  const cloth = 'var(--accent-2)';
  return (
    <svg viewBox="0 0 35 45" width={width} height={height} aria-hidden style={frame}>
      <rect width="35" height="45" fill="var(--accent-soft)" />
      {variant === 'headscarf' ? (
        <>
          {/* scarf drapes from the crown over the shoulders */}
          <path d="M2 46c0-9 4.5-14.5 9.5-16.5-2-3.3-3.2-6.5-3.2-9.8a9.2 9.2 0 0118.4 0c0 3.3-1.2 6.5-3.2 9.8 5 2 9.5 7.5 9.5 16.5z" fill={cloth} opacity="0.9" />
          <ellipse cx="17.5" cy="20.5" rx="5.9" ry="7" fill={skin} opacity="0.55" />
        </>
      ) : (
        <>
          <path d="M3 46c0-9 6-14 14.5-14S32 37 32 46z" fill={cloth} opacity="0.85" />
          <circle cx="17.5" cy="19" r="7.5" fill={skin} opacity="0.55" />
          {/* hair */}
          <path d="M10 18c0-5.5 3.3-8.8 7.5-8.8s7.5 3.3 7.5 8.8c-1.5-2.6-4-3.9-7.5-3.9S11.5 15.4 10 18z" fill={cloth} opacity="0.95" />
          {variant === 'beard' && (
            <path d="M10.4 20.2c.3 5.6 3.2 8.9 7.1 8.9s6.8-3.3 7.1-8.9c-.9 2.6-2.4 4.3-4.1 4.9-.9-.5-1.9-.8-3-.8s-2.1.3-3 .8c-1.7-.6-3.2-2.3-4.1-4.9z" fill={cloth} opacity="0.95" />
          )}
        </>
      )}
    </svg>
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
