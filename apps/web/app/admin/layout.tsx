import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { createAdminSupabase, getCurrentUser } from '@/lib/supabase/server';
import { AdminSidebar } from '@/components/admin-sidebar';
import { SignOutButton } from '@/components/sign-out-button';

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

  const label = profile.full_name ?? user.email;

  return (
    <div className="admin-shell">
      <AdminSidebar>
        <div className="stack" style={{ gap: '0.6rem' }}>
          <span className="small muted" style={{ paddingLeft: '0.2rem' }}>
            {label}
          </span>
          <SignOutButton />
        </div>
      </AdminSidebar>

      <div className="admin-main">
        <div className="admin-topbar">
          <span className="admin-topbar-title">Admin</span>
          <Link href="/" className="nav-link small">
            View site ↗
          </Link>
        </div>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
