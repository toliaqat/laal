import { createAdminSupabase, getCurrentUser } from '@/lib/supabase/server';
import { Button, Card, Field } from '@/components/ui';
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
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="container narrow">
        <Card>
          <h1>Invitation</h1>
          <p className="muted">This link is missing its invitation token.</p>
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
          <h1>Invitation unavailable</h1>
          <p className="muted">
            This invitation has expired, been used, or was revoked. Ask an admin
            to send a new one.
          </p>
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
          <h1>Accept your invitation</h1>
          <p className="muted">
            Sign in (or create an account) with <strong>{invite!.email}</strong>{' '}
            to continue.
          </p>
          <div className="row">
            <Button href={`/login?next=${next}`}>Sign in</Button>
            <Button href={`/signup?next=${next}`} variant="ghost">
              Create account
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
        <p className="eyebrow">Partner organization</p>
        {org ? (
          <>
            <h1>Join {org.name}</h1>
            <p className="muted">
              Accept to manage this organization on Laal — complete its profile
              and connect a bank account so funds can reach you.
            </p>
            <form action={acceptOrgInvite} className="stack">
              <input type="hidden" name="token" value={token} />
              <Button type="submit">Accept &amp; continue</Button>
            </form>
          </>
        ) : (
          <>
            <h1>Set up your organization</h1>
            <p className="muted">
              Tell us about your organization. An admin will review it before it
              can receive funds; you can connect your bank account next.
            </p>
            <form action={acceptOrgInvite} className="stack">
              <input type="hidden" name="token" value={token} />
              <Field label="Organization name">
                <input className="input" name="name" required />
              </Field>
              <Field label="Type">
                <select className="select" name="type" defaultValue="community">
                  {ORG_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Country">
                <input className="input" name="country" />
              </Field>
              <Field label="Description">
                <textarea className="textarea" name="description" rows={4} />
              </Field>
              <Button type="submit">Create &amp; continue</Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
