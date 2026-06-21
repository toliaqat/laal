import Link from 'next/link';
import { SignupForm } from './signup-form';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <>
      <h1 style={{ fontSize: '1.5rem', marginTop: 0, marginBottom: '0.25rem' }}>
        Create your account
      </h1>
      <p style={{ color: '#555', marginTop: 0, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Join Ashfaat to start or support a campaign.
      </p>

      <SignupForm next={next} />

      <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: '#555' }}>
        Already have an account?{' '}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          style={{ color: '#1a1a1a', fontWeight: 500 }}
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
