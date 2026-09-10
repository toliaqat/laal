/**
 * Date formatting helpers for the mobile app.
 *
 * Hermes ships a trimmed Intl: `Intl.RelativeTimeFormat` is present on modern
 * iOS/Android JSC+Hermes builds but not everywhere, and even where it exists it
 * can throw for locales the platform doesn't carry. Everything below therefore
 * degrades to the absolute `toLocaleDateString` pattern already used by
 * app/account.tsx rather than crashing a screen over a timestamp.
 */

/** Urdu needs Latin digits pinned, matching formatMoney across the apps. */
function intlLocale(locale: string): string {
  return locale === 'ur' ? 'ur-PK-u-nu-latn' : locale;
}

/** Absolute date, e.g. "12 Mar 2026". Empty string if unformattable. */
export function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(intlLocale(locale), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Beyond a week, "9 days ago" is less useful than the date itself. */
const RELATIVE_WINDOW = 7 * DAY;

/**
 * "2 hours ago" for recent timestamps, falling back to {@link formatDate} for
 * anything older than a week — or whenever Intl.RelativeTimeFormat is missing
 * or unhappy with the locale.
 */
export function formatRelative(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const diff = d.getTime() - Date.now();
  if (Math.abs(diff) < RELATIVE_WINDOW) {
    try {
      const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), {
        numeric: 'auto',
      });
      const abs = Math.abs(diff);
      if (abs < MINUTE) return rtf.format(Math.round(diff / 1000), 'second');
      if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), 'minute');
      if (abs < DAY) return rtf.format(Math.round(diff / HOUR), 'hour');
      return rtf.format(Math.round(diff / DAY), 'day');
    } catch {
      // No RelativeTimeFormat on this engine — absolute date below.
    }
  }
  return formatDate(iso, locale);
}
