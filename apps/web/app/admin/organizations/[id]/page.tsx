import { notFound } from 'next/navigation';
import { createAdminSupabase } from '@/lib/supabase/server';
import { Button, Card, Field } from '@/components/ui';
import { inviteOrgMember, revokeOrgInvite, updateOrganization } from '../actions';

const ORG_TYPES = [
  'embassy',
  'funeral_home',
  'charity',
  'employer',
  'community',
  'religious',
] as const;

const ORG_STATUSES = ['pending', 'verified', 'suspended'] as const;

export default async function EditOrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminSupabase();
  const { data: org } = await supabase
    .from('organizations')
    .select(
      'id, name, type, country, contact_email, contact_phone, description, status, can_be_beneficiary, can_be_verifier',
    )
    .eq('id', id)
    .single();

  if (!org) notFound();

  const { data: invites } = await supabase
    .from('organization_invites')
    .select('id, email, member_role, status, created_at')
    .eq('organization_id', id)
    .order('created_at', { ascending: false });

  const { data: members } = await supabase
    .from('organization_members')
    .select('id, org_role, profiles:profile_id(full_name, email)')
    .eq('organization_id', id);

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Administration</p>
        <h1>Edit organization</h1>
        <p className="muted">{org.name}</p>
      </div>

      <Card>
        <form action={updateOrganization} className="stack">
          <input type="hidden" name="id" value={org.id} />
          <div className="grid">
            <Field label="Name">
              <input
                className="input"
                name="name"
                defaultValue={org.name ?? ''}
                required
              />
            </Field>
            <Field label="Type">
              <select
                className="select"
                name="type"
                defaultValue={org.type ?? 'charity'}
              >
                {ORG_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Country">
              <input
                className="input"
                name="country"
                defaultValue={org.country ?? ''}
              />
            </Field>
            <Field label="Status">
              <select
                className="select"
                name="status"
                defaultValue={org.status ?? 'pending'}
              >
                {ORG_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Contact email">
              <input
                className="input"
                type="email"
                name="contact_email"
                defaultValue={org.contact_email ?? ''}
              />
            </Field>
            <Field label="Contact phone">
              <input
                className="input"
                name="contact_phone"
                defaultValue={org.contact_phone ?? ''}
              />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              className="textarea"
              name="description"
              rows={4}
              defaultValue={org.description ?? ''}
            />
          </Field>
          <div className="row wrap">
            <label className="row small">
              <input
                type="checkbox"
                name="can_be_beneficiary"
                defaultChecked={Boolean(org.can_be_beneficiary)}
              />{' '}
              Can be beneficiary
            </label>
            <label className="row small">
              <input
                type="checkbox"
                name="can_be_verifier"
                defaultChecked={Boolean(org.can_be_verifier)}
              />{' '}
              Can be verifier
            </label>
          </div>
          <div className="row">
            <Button type="submit">Save changes</Button>
            <Button href="/admin/organizations" variant="ghost">
              Cancel
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2>Members</h2>
        <p className="muted small">
          People who can sign in and manage this organization.
        </p>
        {(members ?? []).length === 0 ? (
          <p className="muted small">No members yet — invite someone below.</p>
        ) : (
          <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
            {(members ?? []).map((m) => {
              const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
              return (
                <li key={m.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{p?.full_name || p?.email || 'Unknown'}</span>
                  <span className="small muted">{m.org_role}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2>Invite a member</h2>
        <p className="muted small">
          They’ll get an email link to claim this organization, complete its
          profile, and connect a bank account via Stripe.
        </p>
        <form action={inviteOrgMember} className="stack">
          <input type="hidden" name="organization_id" value={org.id} />
          <div className="grid">
            <Field label="Email">
              <input className="input" type="email" name="email" required />
            </Field>
            <Field label="Role">
              <select className="select" name="member_role" defaultValue="lead">
                <option value="lead">Lead (manage + onboard)</option>
                <option value="staff">Staff (view only)</option>
              </select>
            </Field>
          </div>
          <div className="row">
            <Button type="submit">Send invite</Button>
          </div>
        </form>

        {(invites ?? []).filter((i) => i.status === 'pending').length > 0 && (
          <div className="stack" style={{ marginTop: '1rem' }}>
            <h3 className="small">Pending invites</h3>
            {(invites ?? [])
              .filter((i) => i.status === 'pending')
              .map((i) => (
                <div
                  key={i.id}
                  className="row"
                  style={{ justifyContent: 'space-between' }}
                >
                  <span className="small">
                    {i.email} · {i.member_role}
                  </span>
                  <form action={revokeOrgInvite}>
                    <input type="hidden" name="invite_id" value={i.id} />
                    <Button type="submit" variant="ghost">
                      Revoke
                    </Button>
                  </form>
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}
