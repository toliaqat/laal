import { defineRouting } from 'next-intl/routing';
import { locales } from '@laal/i18n';

/**
 * Locale routing for the public site. URL-prefixed for every locale
 * (`/en/...`, `/ur/...`) so each language has its own indexable URLs.
 *
 * The website defaults to Urdu: a visitor with no explicit choice lands on
 * `/ur`. We set `localeDetection: false` so the browser's Accept-Language does
 * NOT override that (otherwise English browsers would be sent to `/en`). An
 * explicit choice is still remembered — the language switcher writes a
 * `NEXT_LOCALE` cookie that our middleware honors before this default applies.
 */
export const webDefaultLocale = 'ur' as const;

export const routing = defineRouting({
  locales,
  defaultLocale: webDefaultLocale,
  localePrefix: 'always',
  localeDetection: false,
});
