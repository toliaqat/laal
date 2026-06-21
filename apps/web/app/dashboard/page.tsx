import { redirect } from 'next/navigation';
import type { Campaign } from '@ashfaat/types';
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server';
import {
  Badge,
  Button,
  Card,
  Container,
  Progress,
  formatMoney,
  statusTone,
} from '@/components/ui';

export const metadata = {
  title: 'Your campaigns — Ashfaat',
};

const STATUS_LABELS: Record<Campaign['status'], string> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  closed: 'Closed',
  rejected: 'Rejected',
};

function isEditable(status: Campaign['status']): boolean {
  return status === 'draft' || status === 'pending_review';
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
    <main className="section">
      <Container narrow>
        <div className="row-between wrap" style={{ marginBottom: '2rem' }}>
          <div className="stack" style={{ gap: '0.25rem' }}>
            <span className="eyebrow">Dashboard</span>
            <h1 style={{ margin: 0 }}>Your campaigns</h1>
          </div>
          <Button href="/start" variant="primary">
            Start a campaign
          </Button>
        </div>

        {campaigns.length === 0 ? (
          <Card large>
            <div className="stack center">
              <h3 style={{ margin: 0 }}>No campaigns yet</h3>
              <p className="muted" style={{ margin: 0 }}>
                Create a dignified memorial fund. We review every campaign
                before it goes live.
              </p>
              <div>
                <Button href="/start" variant="primary">
                  Start your first campaign
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="stack">
            {campaigns.map((c) => {
              const pct =
                c.goal_amount > 0
                  ? (c.amount_raised / c.goal_amount) * 100
                  : 0;
              return (
                <Card key={c.id}>
                  <div className="stack">
                    <div className="row-between wrap" style={{ gap: '0.75rem' }}>
                      <h3 style={{ margin: 0 }}>{c.title}</h3>
                      <Badge tone={statusTone(c.status)}>
                        {STATUS_LABELS[c.status]}
                      </Badge>
                    </div>

                    <p className="muted small" style={{ margin: 0 }}>
                      In memory of {c.deceased_name}
                    </p>

                    <Progress value={pct} />
                    <p className="small" style={{ margin: 0 }}>
                      <strong>{formatMoney(c.amount_raised, c.currency)}</strong>{' '}
                      raised of {formatMoney(c.goal_amount, c.currency)}
                    </p>

                    <div className="row wrap">
                      {isEditable(c.status) ? (
                        <Button
                          href={`/dashboard/campaigns/${c.id}/edit`}
                          variant="primary"
                          size="sm"
                        >
                          Edit
                        </Button>
                      ) : (
                        <Button
                          href={`/campaigns/${c.slug}`}
                          variant="ghost"
                          size="sm"
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Container>
    </main>
  );
}
