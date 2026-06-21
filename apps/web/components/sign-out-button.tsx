'use client';

import { useTransition } from 'react';
import { signOut } from '@/app/(auth)/actions';

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
