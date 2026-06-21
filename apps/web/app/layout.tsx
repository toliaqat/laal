import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/supabase/server';
import { SignOutButton } from '@/components/sign-out-button';

export const metadata: Metadata = {
  title: 'Ashfaat — Support expat families in loss',
  description:
    'Dignified, verified memorial fundraising for expats and their families. Create a campaign, give with confidence, and see funds reach verified beneficiaries.',
};

async function Nav() {
  let signedIn = false;
  try {
    signedIn = Boolean(await getCurrentUser());
  } catch {
    signedIn = false; // env/DB not ready — render signed-out nav
  }

  return (
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
  );
}

function Footer() {
  return (
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
  );
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {await Nav()}
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
