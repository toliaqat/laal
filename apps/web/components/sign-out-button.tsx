'use client';

import { useTransition } from 'react';
import { signOut } from '@/app/(auth)/actions';

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
      style={{
        padding: '0.5rem 0.9rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: '#1a1a1a',
        background: '#fff',
        border: '1px solid #d4d4d4',
        borderRadius: 8,
        cursor: 'pointer',
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
