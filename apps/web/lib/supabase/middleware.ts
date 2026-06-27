import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isLocale, defaultLocale } from '@laal/i18n';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

/** Routes that require an authenticated session (locale prefix stripped). */
const PROTECTED_PREFIXES = ['/start', '/dashboard', '/admin'];

/** Split a locale-prefixed pathname into its locale and the rest of the path. */
function splitLocale(pathname: string): { locale: string; rest: string } {
  const [, maybeLocale, ...segments] = pathname.split('/');
  if (isLocale(maybeLocale)) {
    return { locale: maybeLocale, rest: '/' + segments.join('/') };
  }
  return { locale: defaultLocale, rest: pathname };
}

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users away from protected routes.
 *
 * Runs *after* next-intl's middleware: it writes refreshed auth cookies onto
 * the response next-intl produced, and does its protected-route check against
 * the locale-stripped path so `/ur/start` is gated just like `/start`.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  const supabase = createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const { locale, rest } = splitLocale(pathname);
  const isProtected = PROTECTED_PREFIXES.some((p) => rest.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
