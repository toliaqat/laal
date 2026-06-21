import Link from 'next/link';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <>
      <h1 style={{ fontSize: '1.5rem', marginTop: 0, marginBottom: '0.25rem' }}>
        Sign in
      </h1>
      <p style={{ color: '#555', marginTop: 0, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Welcome back to Ashfaat.
      </p>

      <LoginForm next={next} />

      <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: '#555' }}>
        No account?{' '}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}
          style={{ color: '#1a1a1a', fontWeight: 500 }}
        >
          Create one
        </Link>
      </p>
    </>
  );
}
