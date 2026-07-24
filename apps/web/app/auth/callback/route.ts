import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { APP_URL } from '@/lib/env';

function safeNext(next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return next;
  }
  return '/dashboard';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  // Redirect against the public base URL, NOT request.url — behind Fly's proxy
  // the latter is the internal bind address (http://0.0.0.0:3000).
  const base = APP_URL();

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${base}${next}`);
    }
  }

  // Failed or missing code exchange: land on login with a visible explanation
  // instead of silently dropping the user there.
  return NextResponse.redirect(`${base}/login?error=oauth`);
}
