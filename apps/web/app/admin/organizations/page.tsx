import { createAdminSupabase } from '@/lib/supabase/server';
import { Badge, Button } from '@/components/ui';
import { NewOrganizationForm } from './new-org-form';

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

      <NewOrganizationForm />

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
