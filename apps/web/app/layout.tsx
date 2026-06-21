import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/supabase/server';
import { SiteChrome } from '@/components/site-chrome';

export const metadata: Metadata = {
  title: 'Ashfaat — Support expat families in loss',
  description:
    'Dignified, verified memorial fundraising for expats and their families. Create a campaign, give with confidence, and see funds reach verified beneficiaries.',
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  let signedIn = false;
  try {
    signedIn = Boolean(await getCurrentUser());
  } catch {
    signedIn = false; // env/DB not ready — render signed-out chrome
  }

  return (
    <html lang="en">
      <body>
        <SiteChrome signedIn={signedIn}>{children}</SiteChrome>
      </body>
    </html>
  );
}
