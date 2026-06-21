'use client';

import { useActionState } from 'react';
import { signUp, type AuthState } from '../actions';

export function SignupForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signUp,
    undefined,
  );

  return (
    <form action={formAction} className="stack">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="field">
        <label htmlFor="full_name" className="label">
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          required
          className="input"
        />
      </div>

      <div className="field">
        <label htmlFor="email" className="label">
          Email
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
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="input"
        />
      </div>

      {state?.error ? <p className="error-text">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-block"
      >
        {pending ? 'Creating your account…' : 'Create account'}
      </button>
    </form>
  );
}
