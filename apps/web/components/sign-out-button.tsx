'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { signOut } from '@/app/[locale]/(auth)/actions';

export function SignOutButton() {
  const t = useTranslations('nav');
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
    >
      {pending ? t('signingOut') : t('signOut')}
    </button>
  );
}
