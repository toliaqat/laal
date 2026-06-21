import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/supabase/server';
import { getMyMemberships } from '@/lib/org-auth';
import { SiteChrome } from '@/components/site-chrome';

export const metadata: Metadata = {
  title: 'Laal — Every life is precious',
  description:
    'Everyone is someone’s Laal. Support real people facing difficult moments — every fundraiser is reviewed, and kindness reaches the right people, with dignity.',
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  let signedIn = false;
  let isOrgMember = false;
  try {
    signedIn = Boolean(await getCurrentUser());
    if (signedIn) isOrgMember = (await getMyMemberships()).length > 0;
  } catch {
    signedIn = false; // env/DB not ready — render signed-out chrome
  }

  return (
    <html lang="en">
      <body>
        <SiteChrome signedIn={signedIn} isOrgMember={isOrgMember}>
          {children}
        </SiteChrome>
      </body>
    </html>
  );
}
