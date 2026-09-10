import type { ReactNode } from 'react';

/**
 * Pure-CSS recreations of the Laal mobile app screens, for marketing use.
 * No bundled image assets — these render crisp at any scale and stay on-brand.
 * Content mirrors the real app (campaign list + detail) in Laal's voice.
 */

function StatusBar() {
  return (
    <div className="app-status">
      <span>9:41</span>
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
  memory,
  pct,
  raised,
  goal,
}: {
  title: string;
  memory: string;
  pct: number;
  raised: string;
  goal: string;
}) {
  return (
    <div className="app-card">
      <div className="app-card-title ugc">{title}</div>
      <div className="app-card-mem">
        In memory of <span className="ugc">{memory}</span>
      </div>
      <div className="app-bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="app-amounts">
        <span className="app-raised num">{raised}</span>
        <span className="app-goal">
          of <span className="num">{goal}</span>
        </span>
      </div>
    </div>
  );
}

/** The home / stories list screen. */
export function PhoneListScreen() {
  return (
    <div className="phone-screen">
      <div className="phone-notch" aria-hidden />
      <StatusBar />
      <div className="app-body">
        <div className="app-h">
          <span className="app-title ugc">Fundraisers</span>
          {/* plaintext bidi keeps the check glyph attached to the word in RTL */}
          <span className="app-pill ugc">✓ Verified</span>
        </div>
        <p className="app-sub">People near you who could use a hand.</p>
        <MiniCard
          title="Bringing Amir home"
          memory="Amir Hussain"
          pct={78}
          raised="$3,920"
          goal="$5,000"
        />
        <MiniCard
          title="Standing with the Khan family"
          memory="Bilal Khan"
          pct={54}
          raised="$2,700"
          goal="$5,000"
        />
        <MiniCard
          title="A dignified farewell for Mariam"
          memory="Mariam Sayed"
          pct={92}
          raised="$4,600"
          goal="$5,000"
        />
      </div>
    </div>
  );
}

/** The campaign detail screen, with the sticky support action. */
export function PhoneDetailScreen() {
  return (
    <div className="phone-screen">
      <div className="phone-notch" aria-hidden />
      <StatusBar />
      <div className="app-body" style={{ paddingBottom: '5.5rem' }}>
        <div className="app-h" style={{ marginBottom: '0.1rem' }}>
          <span className="app-title ugc" style={{ fontSize: '1.15rem' }}>
            Bringing Amir home
          </span>
        </div>
        <p className="app-sub">
          In memory of <span className="ugc">Amir Hussain</span>
        </p>
        <div className="app-bar">
          <span style={{ width: '78%' }} />
        </div>
        <div className="app-amounts">
          <span className="app-raised">
            <span className="num">$3,920</span> raised
          </span>
          <span className="app-goal">
            of <span className="num">$5,000</span>
          </span>
        </div>
        <p className="app-story ugc">
          Amir worked far from home to give his children a future. His family now
          hopes to bring him back to rest among the people who loved him. Every
          contribution is verified and goes to his family with care.
        </p>
        <div className="app-bene ugc">
          Support reaches <strong>Fatima Hussain</strong> (daughter), a confirmed
          family member.
        </div>
      </div>
      <div className="app-cta">
        <span className="app-cta-btn">Help Now</span>
        <p className="app-cta-note">Secure · every fundraiser reviewed before support</p>
      </div>
    </div>
  );
}

/**
 * Two phones — a back-staggered list behind a front detail screen — that float
 * gently. Mirrors how the app actually looks.
 */
export function PhoneShowcase() {
  return (
    <div className="phone-stage">
      <div className="phone phone-back phone-floating" aria-hidden>
        <PhoneListScreen />
      </div>
      <div
        className="phone phone-front phone-floating"
        role="img"
        aria-label="The Laal mobile app showing a verified campaign and a Help Now button"
      >
        <PhoneDetailScreen />
      </div>
    </div>
  );
}

/** A single floating phone (used in the hero). */
export function PhoneHero({ children }: { children?: ReactNode }) {
  return (
    <div
      className="phone phone-floating"
      role="img"
      aria-label="The Laal mobile app showing verified fundraisers you can support"
    >
      {children ?? <PhoneListScreen />}
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
