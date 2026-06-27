import '../globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { dirFor } from '@laal/i18n';
import { getCurrentUser } from '@/lib/supabase/server';
import { getMyMemberships } from '@/lib/org-auth';
import { SiteChrome } from '@/components/site-chrome';
import { routing } from '@/i18n/routing';
import { urduSerif, urduSans } from './fonts';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // Enable static rendering for this locale.
  setRequestLocale(locale);

  let signedIn = false;
  let isOrgMember = false;
  try {
    signedIn = Boolean(await getCurrentUser());
    if (signedIn) isOrgMember = (await getMyMemberships()).length > 0;
  } catch {
    signedIn = false; // env/DB not ready — render signed-out chrome
  }

  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      className={`${urduSerif.variable} ${urduSans.variable}`}
    >
      <body>
        <NextIntlClientProvider>
          <SiteChrome signedIn={signedIn} isOrgMember={isOrgMember}>
            {children}
          </SiteChrome>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
