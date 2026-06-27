'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { APP_URL } from '@/lib/env';

export type AuthState = { error: string } | undefined;

function safeNext(next: FormDataEntryValue | null): string {
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) {
    return next;
  }
  return '/dashboard';
}

export async function signIn(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(next);
}

export async function signUp(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const fullName = String(formData.get('full_name') ?? '');
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${APP_URL()}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}
