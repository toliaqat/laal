import { Platform } from 'react-native';

/**
 * Laal design tokens for the mobile app — mirrors the web beige system
 * (apps/web/app/globals.css). Warm, dignified, calm.
 */
export const colors = {
  bg: '#f3eee4',
  surface: '#fbf8f2',
  surface2: '#f7f1e7',
  ink: '#2a2620',
  inkSoft: '#4a443b',
  muted: '#837a6b',
  line: '#e6ddcd',
  lineStrong: '#d8ccb6',

  accent: '#9c6b4a',
  accentHover: '#855a3d',
  accentInk: '#fffdf8',
  accentSoft: '#efe1d3',

  success: '#5c7a52',
  successBg: '#e8efe2',
  successLine: '#cfe0c4',
  danger: '#a4503f',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** A warm serif for headings (memorial warmth), matching the web. */
export const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

/** Soft, warm elevation shared by cards. */
export const cardShadow = {
  shadowColor: '#2a2620',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

/** Stronger lift for accent / primary surfaces. */
export const accentShadow = {
  shadowColor: colors.accent,
  shadowOpacity: 0.28,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

/** First name from a full name (for greetings + avatars). */
export function firstName(name?: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

/** Up-to-two-letter initials for the avatar. */
export function initials(name?: string | null, email?: string | null): string {
  const source = (name && name.trim()) || (email && email.trim()) || '';
  if (!source) return '·';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
