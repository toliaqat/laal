import Link from 'next/link';
import { SignupForm } from './signup-form';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="stack">
      <div className="stack" style={{ gap: '0.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Create your account</h1>
        <p className="small muted" style={{ margin: 0 }}>
          Join Ashfaat to start or support a campaign.
        </p>
      </div>

      <SignupForm next={next} />

      <p className="small muted" style={{ margin: 0 }}>
        Already have an account?{' '}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          style={{ color: 'var(--accent)', fontWeight: 500 }}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
