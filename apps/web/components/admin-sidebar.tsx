'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, usePathname } from '@/i18n/navigation';

type Item = { href: string; label: string; icon: ReactNode; exact?: boolean };

const I = {
  menu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  ),
  external: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
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
  send: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12l2 2 4-4" /><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  ),
};

const ITEMS: Item[] = [
  { href: '/admin', label: 'Overview', icon: I.grid, exact: true },
  { href: '/admin/campaigns', label: 'Campaigns', icon: I.flag },
  { href: '/admin/verifications', label: 'Verifications', icon: I.check },
  { href: '/admin/donations', label: 'Donations', icon: I.heart },
  { href: '/admin/releases', label: 'Releases', icon: I.send },
  { href: '/admin/organizations', label: 'Organizations', icon: I.building },
  { href: '/admin/accounts', label: 'Accounts', icon: I.users },
  { href: '/admin/audit', label: 'Audit log', icon: I.list },
];

export function AdminSidebar({ children }: { children?: ReactNode }) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);

  // Collapse the mobile drawer whenever navigation lands on a new route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <aside className={`admin-sidebar${open ? ' open' : ''}`}>
      <div className="admin-sidebar-head">
        <Link href="/admin" className="admin-brand">
          <span className="admin-brand-badge">L</span>
          Laal
        </Link>
        <button
          type="button"
          className="admin-burger"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? I.close : I.menu}
        </button>
      </div>
      <div className="admin-sidebar-body">
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
          <Link href="/" className="admin-link admin-view-site">
            {I.external}
            View site
          </Link>
        </nav>
        <div className="admin-sidebar-foot">{children}</div>
      </div>
    </aside>
  );
}
