'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { SignOutButton } from '@/components/sign-out-button';
import { LanguageSwitcher } from '@/components/language-switcher';

/** Skip-link target. Pages render their own <main>, so the chrome focuses this
 *  wrapper instead of duplicating the landmark. */
const CONTENT_ID = 'laal-content';

/**
 * Public site chrome (top nav + footer). Hidden on /admin, which renders its
 * own full-screen dashboard shell.
 *
 * On mobile the top bar stays clean: the inline links collapse behind a burger
 * button that toggles a drawer. The drawer behaves like a real dialog-ish
 * surface — a scrim dims the page, the page behind cannot scroll, and Escape or
 * a tap outside closes it.
 *
 * Landmarks: the chrome intentionally does NOT render <main>. Every page owns
 * its own <main>, and two main landmarks per page confuses screen readers.
 */
export function SiteChrome({
  signedIn,
  isOrgMember = false,
  children,
}: {
  signedIn: boolean;
  isOrgMember?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('nav');
  // next-intl's usePathname returns the path *without* the locale prefix,
  // so the /admin check still matches `/ur/admin` and `/en/admin`.
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  // Close the mobile drawer whenever navigation lands on a new route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // While the drawer is open: lock the page behind it, close on Escape, and
  // close on any pointer press outside the header (the scrim covers the rest).
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('nav-locked');

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      const node = e.target as Node | null;
      if (node && headerRef.current?.contains(node)) return;
      setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.body.classList.remove('nav-locked');
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  if (pathname?.startsWith('/admin')) {
    return <>{children}</>;
  }

  return (
    <div className="site-shell">
      {/* First focusable element on the page, for keyboard and switch users. */}
      <a href={`#${CONTENT_ID}`} className="skip-link">
        {t('skipToContent')}
      </a>
      <header className="nav" ref={headerRef}>
        <div className="container nav-inner">
          <Link href="/" className="brand">
            Laal
          </Link>
          <button
            type="button"
            className="nav-burger"
            aria-label={open ? t('closeMenu') : t('openMenu')}
            aria-expanded={open}
            aria-controls="laal-nav-links"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <BurgerIcon />}
          </button>
          <nav
            id="laal-nav-links"
            className={`nav-links${open ? ' open' : ''}`}
            aria-label={t('primaryLabel')}
          >
            <Link href="/campaigns" className="nav-link">
              {t('fundraisers')}
            </Link>
            <Link href="/start" className="nav-link">
              {t('start')}
            </Link>
            {signedIn ? (
              <>
                <Link href="/dashboard" className="nav-link">
                  {t('dashboard')}
                </Link>
                {isOrgMember && (
                  <Link href="/org" className="nav-link">
                    {t('organization')}
                  </Link>
                )}
                <SignOutButton />
              </>
            ) : (
              <Link href="/login" className="btn btn-primary btn-sm">
                {t('signIn')}
              </Link>
            )}
            <LanguageSwitcher />
          </nav>
        </div>
      </header>
      {open && <div className="nav-scrim" aria-hidden />}
      {/* tabIndex=-1 makes this a valid skip-link destination without adding a
          second landmark; pages supply the <main> inside. */}
      <div id={CONTENT_ID} className="site-content" tabIndex={-1}>
        {children}
      </div>
      <footer className="footer">
        <div className="container row-between wrap">
          <span>{t('copyright', { year: new Date().getFullYear() })}</span>
          <nav className="footer-nav" aria-label={t('footerLabel')}>
            <Link href="/campaigns" className="nav-link">
              {t('browse')}
            </Link>
            <Link href="/start" className="nav-link">
              {t('start')}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function BurgerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
