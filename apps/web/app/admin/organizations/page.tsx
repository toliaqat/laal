import { createAdminSupabase } from '@/lib/supabase/server';
import { Badge, Button, Card, Field } from '@/components/ui';
import { createOrganization } from './actions';

const ORG_TYPES = [
  'embassy',
  'funeral_home',
  'charity',
  'employer',
  'community',
  'religious',
] as const;

function statusTone(status: string): 'default' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'verified':
      return 'success';
    case 'pending':
      return 'warning';
    case 'suspended':
      return 'danger';
    default:
      return 'default';
  }
}

export default async function OrganizationsPage() {
  const supabase = createAdminSupabase();
  const { data: orgs } = await supabase
    .from('organizations')
    .select(
      'id, name, type, country, status, can_be_beneficiary, can_be_verifier, stripe_onboarding_complete',
    )
    .order('created_at', { ascending: false });

  const rows = orgs ?? [];

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Administration</p>
        <h1>Organizations</h1>
        <p className="muted">
          Embassies, funeral homes, charities and partners.
        </p>
      </div>

      <Card>
        <h3>New organization</h3>
        <form action={createOrganization} className="stack">
          <div className="grid">
            <Field label="Name">
              <input className="input" name="name" required />
            </Field>
            <Field label="Type">
              <select className="select" name="type" defaultValue="charity">
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
            <Field label="Contact email">
              <input className="input" type="email" name="contact_email" />
            </Field>
            <Field label="Contact phone">
              <input className="input" name="contact_phone" />
            </Field>
          </div>
          <Field label="Description">
            <textarea className="textarea" name="description" rows={3} />
          </Field>
          <div className="row wrap">
            <label className="row small">
              <input type="checkbox" name="can_be_beneficiary" /> Can be
              beneficiary
            </label>
            <label className="row small">
              <input type="checkbox" name="can_be_verifier" /> Can be verifier
            </label>
          </div>
          <div className="row">
            <Button type="submit">Create organization</Button>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <p className="muted">No organizations yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Country</th>
              <th>Status</th>
              <th>Beneficiary</th>
              <th>Verifier</th>
              <th>Onboarding</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>{o.name}</td>
                <td className="small">{o.type}</td>
                <td className="small">{o.country ?? '—'}</td>
                <td>
                  <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                </td>
                <td>{o.can_be_beneficiary ? '✓' : '—'}</td>
                <td>{o.can_be_verifier ? '✓' : '—'}</td>
                <td>{o.stripe_onboarding_complete ? '✓' : '—'}</td>
                <td>
                  <Button
                    href={`/admin/organizations/${o.id}`}
                    variant="ghost"
                    size="sm"
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
