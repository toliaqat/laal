/**
 * Shared internationalization config for Laal.
 *
 * This package holds the single source of truth for which locales we support
 * and the message catalogs themselves (see ../messages/<locale>.json).
 *
 * Both apps consume it:
 *   - apps/web   via next-intl
 *   - apps/mobile via i18next + react-i18next
 *
 * v1 scope: UI chrome only. User-generated content (campaign stories, donation
 * messages) is rendered in whatever language the author wrote it — the dir/font
 * handling below means Urdu-authored content still renders correctly.
 */

export const locales = ['en', 'ur'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/** Text direction per locale. Urdu is written right-to-left. */
export const direction: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ur: 'rtl',
};

/** Human-readable names, shown in the language switcher (each in its own script). */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  ur: 'اردو',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

export function dirFor(locale: string): 'ltr' | 'rtl' {
  return isLocale(locale) ? direction[locale] : direction[defaultLocale];
}

export function resolveLocale(locale: string): Locale {
  return isLocale(locale) ? locale : defaultLocale;
}

/**
 * Message catalogs live in ../messages/<locale>.json and are imported directly
 * by each app (next-intl on web, i18next on mobile) so the bundler can resolve
 * them statically — no dynamic import paths.
 */
