'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = { href: string; label: string; icon: ReactNode; exact?: boolean };

const I = {
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  flag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 8h0M15 8h0M9 12h0M15 12h0M9 16h0M15 16h0" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  tools: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 0 0 5 5l-7.8 7.8a2 2 0 0 1-2.8-2.8l7.8-7.8a4 4 0 0 0-1.4-1.4" /><path d="M6 12 3 9a2 2 0 0 1 0-3l3-3 4 4" />
    </svg>
  ),
};

const ITEMS: Item[] = [
  { href: '/admin', label: 'Overview', icon: I.grid, exact: true },
  { href: '/admin/campaigns', label: 'Campaigns', icon: I.flag },
  { href: '/admin/donations', label: 'Donations', icon: I.heart },
  { href: '/admin/organizations', label: 'Organizations', icon: I.building },
  { href: '/admin/accounts', label: 'Accounts', icon: I.users },
  { href: '/admin/audit', label: 'Audit log', icon: I.list },
  { href: '/admin/housekeeping', label: 'Housekeeping', icon: I.tools },
];

export function AdminSidebar({ children }: { children?: ReactNode }) {
  const pathname = usePathname() ?? '';

  return (
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-brand">
        <span className="admin-brand-badge">L</span>
        Laal
      </Link>
      <div className="admin-nav-label">Manage</div>
      <nav className="admin-nav">
        {ITEMS.map((it) => {
          const active = it.exact
            ? pathname === it.href
            : pathname === it.href || pathname.startsWith(`${it.href}/`);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`admin-link${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {it.icon}
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="admin-sidebar-foot">{children}</div>
    </aside>
  );
}
