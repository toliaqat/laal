import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { createAdminSupabase, getCurrentUser } from '@/lib/supabase/server';

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
    <div style={{ minHeight: '100vh' }}>
      <header
        style={{
          borderBottom: '1px solid #eee',
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
        }}
      >
        <strong style={{ fontSize: '1rem' }}>Ashfaat Admin</strong>
        <nav style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
          <Link href="/admin" style={{ color: '#333' }}>
            Overview
          </Link>
          <Link href="/admin/campaigns" style={{ color: '#333' }}>
            Review queue
          </Link>
        </nav>
        <span style={{ marginLeft: 'auto', color: '#888', fontSize: '0.85rem' }}>
          {profile.full_name ?? user.email}
        </span>
      </header>
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {children}
      </main>
    </div>
  );
}
