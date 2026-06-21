'use client';

import { useActionState } from 'react';
import { signIn, type AuthState } from '../actions';

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 500,
  marginBottom: '0.35rem',
  color: '#1a1a1a',
} as const;

const inputStyle = {
  width: '100%',
  padding: '0.6rem 0.7rem',
  fontSize: '0.95rem',
  border: '1px solid #d4d4d4',
  borderRadius: 8,
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
};

const buttonStyle = {
  width: '100%',
  padding: '0.65rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  color: '#fff',
  background: '#1a1a1a',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signIn,
    undefined,
  );

  return (
    <form action={formAction}>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="email" style={labelStyle}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="password" style={labelStyle}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          style={inputStyle}
        />
      </div>

      {state?.error ? (
        <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 1rem' }}>
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} style={{ ...buttonStyle, opacity: pending ? 0.7 : 1 }}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
