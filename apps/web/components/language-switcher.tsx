'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { locales, localeNames, type Locale } from '@laal/i18n';
import { usePathname, useRouter } from '@/i18n/navigation';

/**
 * Switches the active locale while staying on the current page. Re-navigates to
 * the same (locale-stripped) pathname under the chosen locale, so next-intl
 * swaps the URL prefix and re-renders with the new catalog + direction.
 */
export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;
    // Remember the explicit choice so future visits to a locale-less URL (e.g.
    // the bare domain) honor it instead of falling back to the Urdu default.
    // The middleware reads this cookie; localeDetection is off so it's the only
    // signal that overrides the default.
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          className={`lang-option${l === locale ? ' active' : ''}`}
          aria-pressed={l === locale}
          disabled={pending}
          onClick={() => switchTo(l)}
        >
          {localeNames[l]}
        </button>
      ))}
    </div>
  );
}
