import { createAdminSupabase } from '@/lib/supabase/server';
import { ActionForm, SubmitButton } from '@/components/form';
import { Badge } from '@/components/ui';
import { setUserRole } from './actions';

const ROLES = ['donor', 'organizer', 'org_member', 'admin'] as const;

function roleTone(role: string): 'default' | 'success' | 'warning' | 'accent' {
  switch (role) {
    case 'admin':
      return 'accent';
    case 'organizer':
    case 'org_member':
      return 'success';
    default:
      return 'default';
  }
}

export default async function AccountsPage() {
  const supabase = createAdminSupabase();
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .order('created_at', { ascending: false });

  const rows = profiles ?? [];

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Administration</p>
        <h1>Accounts</h1>
        <p className="muted">Manage member roles across the platform.</p>
      </div>

      {rows.length === 0 ? (
        <p className="muted">No accounts yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Change role</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.full_name ?? '—'}</td>
                <td>{p.email ?? '—'}</td>
                <td>
                  <Badge tone={roleTone(p.role)}>{p.role}</Badge>
                </td>
                <td className="small muted">
                  {p.created_at
                    ? new Date(p.created_at).toLocaleDateString()
                    : '—'}
                </td>
                <td>
                  <ActionForm action={setUserRole} className="row" showDetail>
                    <input type="hidden" name="profileId" value={p.id} />
                    <select
                      className="select"
                      name="role"
                      defaultValue={p.role}
                      aria-label={`Role for ${p.full_name ?? p.email ?? p.id}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <SubmitButton variant="ghost" size="sm">Save</SubmitButton>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
