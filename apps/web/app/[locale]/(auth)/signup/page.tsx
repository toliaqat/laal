import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SignupForm } from './signup-form';
import { GoogleButton } from '../google-button';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const t = await getTranslations('auth');

  return (
    <div className="stack">
      <div className="stack" style={{ gap: '0.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{t('signup.title')}</h1>
        <p className="small muted" style={{ margin: 0 }}>
          {t('signup.subtitle')}
        </p>
      </div>

      <SignupForm next={next} />

      <GoogleButton next={next} />

      <p className="small muted" style={{ margin: 0 }}>
        {t('signup.haveAccount')}{' '}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          style={{ color: 'var(--accent)', fontWeight: 500 }}
        >
          {t('signup.signIn')}
        </Link>
      </p>
    </div>
  );
}
