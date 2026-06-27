'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { signIn, type AuthState } from '../actions';

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations('auth');
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signIn,
    undefined,
  );

  return (
    <form action={formAction} className="stack">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="field">
        <label htmlFor="email" className="label">
          {t('login.emailLabel')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
        />
      </div>

      <div className="field">
        <label htmlFor="password" className="label">
          {t('login.passwordLabel')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>

      {state?.error ? <p className="error-text">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-block"
      >
        {pending ? t('login.submitting') : t('login.submit')}
      </button>
    </form>
  );
}
