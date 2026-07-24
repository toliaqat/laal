import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createAdminSupabase, getCurrentUser } from '@/lib/supabase/server';
import { Button, Card, Field } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/form';
import { acceptOrgInvite } from './actions';

const ORG_TYPES = [
  'embassy',
  'funeral_home',
  'charity',
  'employer',
  'community',
  'religious',
] as const;

export default async function AcceptInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('org');
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="container narrow">
        <Card>
          <h1>{t('inviteTitle')}</h1>
          <p className="muted">{t('inviteMissingToken')}</p>
        </Card>
      </div>
    );
  }

  const supabase = createAdminSupabase();
  const { data: invite } = await supabase
    .from('organization_invites')
    .select('id, organization_id, email, status, expires_at, organizations(name)')
    .eq('token', token)
    .maybeSingle();

  const invalid =
    !invite ||
    invite.status !== 'pending' ||
    new Date(invite.expires_at as string).getTime() < Date.now();

  if (invalid) {
    return (
      <div className="container narrow">
        <Card>
          <h1>{t('inviteUnavailableTitle')}</h1>
          <p className="muted">{t('inviteUnavailableBody')}</p>
        </Card>
      </div>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    const next = encodeURIComponent(`/org/accept?token=${token}`);
    return (
      <div className="container narrow">
        <Card>
          <h1>{t('acceptInviteTitle')}</h1>
          <p className="muted">
            {t.rich('acceptInviteBody', {
              email: invite!.email as string,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <div className="row">
            <Button href={`/login?next=${next}`}>{t('signIn')}</Button>
            <Button href={`/signup?next=${next}`} variant="ghost">
              {t('createAccount')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const org = Array.isArray(invite!.organizations)
    ? invite!.organizations[0]
    : invite!.organizations;

  return (
    <div className="container narrow">
      <Card>
        <p className="eyebrow">{t('partnerOrganization')}</p>
        {org ? (
          <>
            <h1>{t('joinOrg', { name: org.name })}</h1>
            <p className="muted">{t('joinOrgBody')}</p>
            <ActionForm action={acceptOrgInvite} className="stack">
              <input type="hidden" name="token" value={token} />
              <SubmitButton>{t('acceptAndContinue')}</SubmitButton>
            </ActionForm>
          </>
        ) : (
          <>
            <h1>{t('setupOrgTitle')}</h1>
            <p className="muted">{t('setupOrgBody')}</p>
            <ActionForm action={acceptOrgInvite} className="stack">
              <input type="hidden" name="token" value={token} />
              <Field label={t('orgNameLabel')}>
                <input className="input" name="name" required />
              </Field>
              <Field label={t('typeLabel')}>
                <select className="select" name="type" defaultValue="community">
                  {ORG_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('fieldCountry')}>
                <input className="input" name="country" />
              </Field>
              <Field label={t('fieldDescription')}>
                <textarea className="textarea" name="description" rows={4} />
              </Field>
              <SubmitButton>{t('createAndContinue')}</SubmitButton>
            </ActionForm>
          </>
        )}
      </Card>
    </div>
  );
}
