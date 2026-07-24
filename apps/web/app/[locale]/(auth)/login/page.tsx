import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LoginForm } from './login-form';
import { GoogleButton } from '../google-button';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const t = await getTranslations('auth');

  return (
    <div className="stack">
      <div className="stack" style={{ gap: '0.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{t('login.title')}</h1>
        <p className="small muted" style={{ margin: 0 }}>
          {t('login.subtitle')}
        </p>
      </div>

      {error === 'oauth' ? (
        <p className="error-text" style={{ margin: 0 }}>
          {t('login.oauthError')}
        </p>
      ) : null}

      <LoginForm next={next} />

      <GoogleButton next={next} />

      <p className="small muted" style={{ margin: 0 }}>
        {t('login.noAccount')}{' '}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}
          style={{ color: 'var(--accent)', fontWeight: 500 }}
        >
          {t('login.createOne')}
        </Link>
      </p>
    </div>
  );
}
