'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { SignOutButton } from '@/components/sign-out-button';
import { LanguageSwitcher } from '@/components/language-switcher';

/**
 * Public site chrome (top nav + footer). Hidden on /admin, which renders its
 * own full-screen dashboard shell.
 *
 * On mobile the top bar stays clean: the inline links collapse behind a burger
 * button that toggles a drawer.
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

  // Close the mobile drawer whenever navigation lands on a new route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (pathname?.startsWith('/admin')) {
    return <>{children}</>;
  }

  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <Link href="/" className="brand">
            Laal
          </Link>
          <button
            type="button"
            className="nav-burger"
            aria-label={open ? t('closeMenu') : t('openMenu')}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <BurgerIcon />}
          </button>
          <nav className={`nav-links${open ? ' open' : ''}`}>
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
      <main>{children}</main>
      <footer className="footer">
        <div className="container row-between wrap">
          <span>{t('copyright', { year: new Date().getFullYear() })}</span>
          <span className="row wrap" style={{ gap: '1rem' }}>
            <Link href="/campaigns" className="nav-link">
              {t('browse')}
            </Link>
            <Link href="/start" className="nav-link">
              {t('start')}
            </Link>
          </span>
        </div>
      </footer>
    </>
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
