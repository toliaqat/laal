import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

function safeNext(next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return next;
  }
  return '/dashboard';
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
