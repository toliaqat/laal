import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { updateSession } from '@/lib/supabase/middleware';

const intlMiddleware = createMiddleware(routing);

const LOCALE_COOKIE = 'NEXT_LOCALE';

function hasLocalePrefix(pathname: string): boolean {
  return routing.locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. Remember an explicit prior choice. The site defaults to Urdu
  //    (routing.defaultLocale) and ignores Accept-Language, but if the visitor
  //    has previously switched language, the language switcher stored their
  //    pick in a cookie — honor it for locale-less URLs before the default
  //    redirect would send them to Urdu.
  if (!hasLocalePrefix(pathname)) {
    const choice = request.cookies.get(LOCALE_COOKIE)?.value;
    if (
      choice &&
      choice !== routing.defaultLocale &&
      (routing.locales as readonly string[]).includes(choice)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `/${choice}${pathname === '/' ? '' : pathname}`;
      return NextResponse.redirect(url);
    }
  }

  // 1. Locale routing. This may issue a redirect (e.g. `/` -> `/ur`), in which
  //    case there's nothing for the session step to attach to.
  const response = intlMiddleware(request);
  if (response.headers.get('location')) {
    return response;
  }

  // 2. Refresh the Supabase session and gate protected routes, writing any
  //    refreshed auth cookies onto the response next-intl produced.
  return updateSession(request, response as NextResponse);
}

export const config = {
  matcher: [
    // Run on everything except static assets, image optimization files, API
    // routes (e.g. the Stripe webhook), and the OAuth callback — none of which
    // are locale-prefixed.
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
