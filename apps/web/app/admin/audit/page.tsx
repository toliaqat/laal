import { createAdminSupabase } from '@/lib/supabase/server';

export default async function AdminAuditPage() {
  const supabase = createAdminSupabase();

  const { data: entries } = await supabase
    .from('audit_log')
    .select('id, actor_id, action, entity_type, entity_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = entries ?? [];

  // Resolve actor emails via profiles lookup.
  const actorIds = Array.from(
    new Set(rows.map((e) => e.actor_id).filter(Boolean)),
  ) as string[];
  const emails = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', actorIds);
    for (const p of profiles ?? []) emails.set(p.id, p.email);
  }

  return (
    <div className="stack">
      <div className="stack" style={{ gap: '0.25rem' }}>
        <span className="eyebrow">Admin</span>
        <h1>Audit log</h1>
        <p className="muted">The 100 most recent administrative actions.</p>
      </div>

      {rows.length === 0 ? (
        <p className="muted">No audit entries yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const meta =
                e.metadata && Object.keys(e.metadata).length > 0
                  ? JSON.stringify(e.metadata)
                  : '';
              return (
                <tr key={e.id}>
                  <td>{new Date(e.created_at).toLocaleString()}</td>
                  <td>
                    {e.actor_id
                      ? emails.get(e.actor_id) ?? e.actor_id
                      : 'system'}
                  </td>
                  <td>
                    <code>{e.action}</code>
                  </td>
                  <td className="small">
                    {e.entity_type}
                    {e.entity_id ? `:${e.entity_id}` : ''}
                  </td>
                  <td className="small muted" style={{ wordBreak: 'break-all' }}>
                    {meta}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
