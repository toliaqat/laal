import Link from 'next/link';
import type { Campaign } from '@ashfaat/types';
import { ProgressBar } from '@/components/progress-bar';

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <Link
      href={`/campaigns/${campaign.slug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <article
        style={{
          border: '1px solid #e5e5e5',
          borderRadius: 12,
          padding: '1.25rem',
          background: '#fff',
        }}
      >
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.125rem' }}>
          {campaign.title}
        </h3>
        <p style={{ margin: '0 0 1rem', color: '#888', fontSize: '0.875rem' }}>
          In memory of {campaign.deceased_name}
        </p>
        <ProgressBar
          raised={campaign.amount_raised}
          goal={campaign.goal_amount}
          currency={campaign.currency}
        />
      </article>
    </Link>
  );
}
