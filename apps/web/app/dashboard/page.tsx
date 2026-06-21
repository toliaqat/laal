import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Campaign, CampaignStatus } from '@ashfaat/types';
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server';
import { ProgressBar } from '@/components/progress-bar';

export const metadata = {
  title: 'Your campaigns — Ashfaat',
};

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  closed: 'Closed',
  rejected: 'Rejected',
};

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: '#888',
  pending_review: '#b8860b',
  active: '#1a7f37',
  paused: '#888',
  completed: '#1a7f37',
  closed: '#555',
  rejected: '#c0392b',
};

function StatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span
      style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        padding: '0.15rem 0.55rem',
        borderRadius: 999,
        border: `1px solid ${STATUS_COLORS[status]}`,
        color: STATUS_COLORS[status],
        whiteSpace: 'nowrap',
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('campaigns')
    .select('*')
    .eq('organizer_id', user.id)
    .order('created_at', { ascending: false });

  const campaigns: Campaign[] = data ?? [];

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Your campaigns</h1>
        <Link
          href="/start"
          style={{
            padding: '0.5rem 0.9rem',
            borderRadius: 8,
            background: '#1a1a1a',
            color: '#fff',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Start a campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div
          style={{
            marginTop: '2.5rem',
            padding: '2rem',
            border: '1px dashed #d4d4d4',
            borderRadius: 12,
            textAlign: 'center',
            color: '#888',
          }}
        >
          <p style={{ margin: 0 }}>You haven&apos;t created any campaigns yet.</p>
          <p style={{ margin: '0.5rem 0 0' }}>
            <Link href="/start">Start your first campaign</Link>
          </p>
        </div>
      ) : (
        <div style={{ marginTop: '2rem', display: 'grid', gap: '1rem' }}>
          {campaigns.map((c) => (
            <article
              key={c.id}
              style={{
                border: '1px solid #e5e5e5',
                borderRadius: 12,
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1rem',
                }}
              >
                <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.125rem' }}>
                  {c.status === 'active' ? (
                    <Link
                      href={`/campaigns/${c.slug}`}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {c.title}
                    </Link>
                  ) : (
                    c.title
                  )}
                </h3>
                <StatusBadge status={c.status} />
              </div>
              <p
                style={{
                  margin: '0 0 1rem',
                  color: '#888',
                  fontSize: '0.875rem',
                }}
              >
                In memory of {c.deceased_name}
              </p>
              <ProgressBar
                raised={c.amount_raised}
                goal={c.goal_amount}
                currency={c.currency}
              />
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
