import Link from 'next/link';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="stack">
      <div className="stack" style={{ gap: '0.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Sign in</h1>
        <p className="small muted" style={{ margin: 0 }}>
          Welcome back to Ashfaat.
        </p>
      </div>

      <LoginForm next={next} />

      <p className="small muted" style={{ margin: 0 }}>
        No account?{' '}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}
          style={{ color: 'var(--accent)', fontWeight: 500 }}
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
