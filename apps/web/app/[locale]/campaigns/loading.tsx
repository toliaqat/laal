import { Container } from '@/components/ui';
import { CampaignCardSkeletonGrid } from '@/components/campaign-card';

/**
 * Route-level placeholder for /campaigns.
 *
 * The route is fully dynamic (Supabase reads auth cookies), so without this the
 * whole main region went blank on every navigation. Shapes mirror the real
 * header — eyebrow, title, subtitle, sort pills — then a grid of card
 * placeholders. Text is intentionally omitted: a loading boundary has no
 * `params`, so it cannot `setRequestLocale`, and translated copy that then gets
 * replaced a beat later reads worse than a calm shimmer.
 *
 * `.skeleton` / `.skeleton-text` / `.skeleton-title` are the shared shimmer
 * utilities in app/globals.css.
 */
export default function CampaignsLoading() {
  return (
    <main className="section" aria-busy="true">
      <Container>
        <div
          className="stack"
          role="status"
          style={{ gap: '0.5rem', marginBottom: '1.25rem' }}
        >
          <div
            className="skeleton skeleton-text"
            style={{ width: '7rem', height: '0.8rem' }}
          />
          <div
            className="skeleton skeleton-title"
            style={{ width: 'min(22rem, 80%)', height: '2.4rem' }}
          />
          <div
            className="skeleton skeleton-text"
            style={{ width: 'min(34rem, 95%)' }}
          />
        </div>

        <div className="pill-row" style={{ marginBottom: '1.75rem' }}>
          <div
            className="skeleton"
            style={{ width: '6rem', height: '2.1rem', borderRadius: 999 }}
          />
          <div
            className="skeleton"
            style={{ width: '9rem', height: '2.1rem', borderRadius: 999 }}
          />
        </div>

        <CampaignCardSkeletonGrid />
      </Container>
    </main>
  );
}
