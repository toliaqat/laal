import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { createAdminSupabase, getCurrentUser } from '@/lib/supabase/server';

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/campaigns', label: 'Campaigns' },
  { href: '/admin/donations', label: 'Donations' },
  { href: '/admin/organizations', label: 'Organizations' },
  { href: '/admin/accounts', label: 'Accounts' },
  { href: '/admin/audit', label: 'Audit log' },
  { href: '/admin/housekeeping', label: 'Housekeeping' },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/');

  const supabase = createAdminSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') redirect('/');

  return (
    <div style={{ minHeight: '60vh' }}>
      <div
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div
          className="container row-between wrap"
          style={{ paddingTop: '0.85rem', paddingBottom: '0.85rem' }}
        >
          <div className="row wrap" style={{ gap: '1.25rem' }}>
            <strong style={{ fontFamily: 'var(--serif)' }}>Admin</strong>
            <nav className="row wrap" style={{ gap: '1rem' }}>
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="nav-link small">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <span className="muted small">{profile.full_name ?? user.email}</span>
        </div>
      </div>
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
        {children}
      </div>
    </div>
  );
}
