import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { resolveLocale } from '@laal/i18n';
import en from '@laal/i18n/messages/en.json';
import ur from '@laal/i18n/messages/ur.json';
import { routing } from './routing';

const catalogs = { en, ur } as const;

/**
 * Per-request i18n config. Resolves the active locale from the URL segment
 * (falling back to the default) and loads its message catalog from @laal/i18n.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: catalogs[resolveLocale(locale)],
  };
});
