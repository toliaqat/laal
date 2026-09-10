import { getFormatter, getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui';
import styles from './campaign-updates.module.css';

/**
 * Public organizer updates feed. Server component: the rows are fetched by the
 * page (see app/[locale]/campaigns/[slug]/updates.ts) with the ordinary cookie
 * client, since RLS already scopes anonymous SELECT to publicly visible
 * campaigns.
 *
 * Author names are deliberately absent: `profiles` SELECT is self-or-admin, so
 * every entry is labelled "From the organizer".
 */

export type CampaignUpdateItem = {
  id: string;
  body: string;
  /** ISO timestamp. */
  createdAt: string;
};

/** Below this age we show "2 days ago"; above it, an absolute date. */
const RELATIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function CampaignUpdates({
  items,
  hasMore,
}: {
  items: CampaignUpdateItem[];
  hasMore: boolean;
}) {
  // The whole section disappears when the organizer hasn't posted anything.
  if (items.length === 0) return null;

  const t = await getTranslations('campaigns');
  const format = await getFormatter();
  const now = new Date();

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{t('detail.updatesHeading')}</h2>
      <div className={styles.list}>
        {items.map((item) => {
          const posted = new Date(item.createdAt);
          const recent = now.getTime() - posted.getTime() < RELATIVE_WINDOW_MS;
          return (
            <Card key={item.id}>
              <div className={styles.meta}>
                <span className={styles.author}>
                  {t('detail.updatesFromOrganizer')}
                </span>
                <time
                  className={styles.time}
                  dateTime={item.createdAt}
                  suppressHydrationWarning
                >
                  {recent
                    ? format.relativeTime(posted, now)
                    : format.dateTime(posted, { dateStyle: 'medium' })}
                </time>
              </div>
              {/* Plain text only — never dangerouslySetInnerHTML. */}
              <p className={styles.body}>{item.body}</p>
            </Card>
          );
        })}
      </div>
      {hasMore && (
        <p className={`small muted ${styles.footer}`}>
          {t('detail.updatesMostRecent')}
        </p>
      )}
    </section>
  );
}
