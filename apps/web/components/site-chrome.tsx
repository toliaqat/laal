'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignOutButton } from '@/components/sign-out-button';

/**
 * Public site chrome (top nav + footer). Hidden on /admin, which renders its
 * own full-screen dashboard shell.
 */
export function SiteChrome({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) {
    return <>{children}</>;
  }

  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <Link href="/" className="brand">
            Ashfaat
          </Link>
          <nav className="nav-links">
            <Link href="/campaigns" className="nav-link">
              Campaigns
            </Link>
            <Link href="/start" className="nav-link">
              Start a campaign
            </Link>
            {signedIn ? (
              <>
                <Link href="/dashboard" className="nav-link">
                  Dashboard
                </Link>
                <SignOutButton />
              </>
            ) : (
              <Link href="/login" className="btn btn-primary btn-sm">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <div className="container row-between wrap">
          <span>© {new Date().getFullYear()} Ashfaat. Made with care.</span>
          <span className="row wrap" style={{ gap: '1rem' }}>
            <Link href="/campaigns" className="nav-link">
              Browse campaigns
            </Link>
            <Link href="/start" className="nav-link">
              Start a campaign
            </Link>
          </span>
        </div>
      </footer>
    </>
  );
}
