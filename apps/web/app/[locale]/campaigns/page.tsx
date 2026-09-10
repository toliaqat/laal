import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Campaign } from '@laal/types';
import { Link } from '@/i18n/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { Container, Card, Button } from '@/components/ui';
import {
  CampaignCard,
  CampaignCardSkeletonGrid,
  CampaignGrid,
} from '@/components/campaign-card';

/** Fundraisers per page. Without this the route rendered every active row. */
const PAGE_SIZE = 12;

/**
 * "Closest to goal" is `amount_raised / goal_amount`, which Postgres can't
 * ORDER BY through the REST API without a view or generated column. We sort a
 * bounded window in memory instead — correct and cheap at launch scale. Move it
 * to a generated `progress_pct` column (indexed) before this cap starts to bite.
 */
const RATIO_WINDOW = 200;

type Sort = 'newest' | 'goal';
const SORTS: Sort[] = ['newest', 'goal'];

type Search = Record<string, string | string[] | undefined>;

function readSort(value: string | string[] | undefined): Sort {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'goal' ? 'goal' : 'newest';
}

function readPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

function listHref(sort: Sort, page: number): string {
  const q = new URLSearchParams();
  if (sort !== 'newest') q.set('sort', sort);
  if (page > 1) q.set('page', String(page));
  const s = q.toString();
  return s ? `/campaigns?${s}` : '/campaigns';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'campaigns' });
  return { title: t('list.metaTitle'), description: t('list.metaDescription') };
}

export default async function CampaignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations('campaigns');

  const sort = readSort(sp.sort);
  const page = readPage(sp.page);

  return (
    <main className="section">
      <Container>
        <div className="stack" style={{ gap: '0.25rem', marginBottom: '1.25rem' }}>
          <span className="eyebrow">{t('list.eyebrow')}</span>
          <h1 style={{ margin: 0 }}>{t('list.title')}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t('list.subtitle')}
          </p>
        </div>

        {/* Two-option sort as pill links — no filter chrome, no JS. */}
        <nav aria-label={t('list.sortLabel')} className="pill-row" style={{ marginBottom: '1.75rem' }}>
          {SORTS.map((option) => {
            const active = option === sort;
            return (
              <Link
                key={option}
                href={listHref(option, 1)}
                className="trust-pill"
                aria-current={active ? 'true' : undefined}
                style={
                  active
                    ? {
                        background: 'var(--accent-soft)',
                        borderColor: '#e3cdba',
                        color: 'var(--accent-hover)',
                      }
                    : undefined
                }
              >
                {option === 'goal'
                  ? t('list.sortClosestToGoal')
                  : t('list.sortNewest')}
              </Link>
            );
          })}
        </nav>

        {/* Streamed so the heading and sort pills paint before Supabase answers.
            `key` forces a fresh fallback whenever the query changes. */}
        <Suspense key={`${sort}:${page}`} fallback={<CampaignCardSkeletonGrid />}>
          <Results locale={locale} sort={sort} page={page} />
        </Suspense>
      </Container>
    </main>
  );
}

type Fetched =
  | { ok: true; campaigns: Campaign[]; total: number }
  | { ok: false };

/**
 * Page of active fundraisers. A fetch failure is reported as such — swallowing
 * it into `[]` used to render "New fundraisers are being reviewed", which is a
 * lie during a Supabase outage.
 */
async function fetchPage(sort: Sort, page: number): Promise<Fetched> {
  try {
    const supabase = await createServerSupabase();

    if (sort === 'goal') {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'active')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(RATIO_WINDOW);
      if (error) return { ok: false };
      const rows = (data as Campaign[] | null) ?? [];
      const ratio = (c: Campaign) =>
        c.goal_amount > 0 ? c.amount_raised / c.goal_amount : 0;
      const sorted = [...rows].sort((a, b) => ratio(b) - ratio(a));
      const from = (page - 1) * PAGE_SIZE;
      return {
        ok: true,
        campaigns: sorted.slice(from, from + PAGE_SIZE),
        total: sorted.length,
      };
    }

    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { ok: false };
    return {
      ok: true,
      campaigns: (data as Campaign[] | null) ?? [],
      total: count ?? 0,
    };
  } catch {
    return { ok: false };
  }
}

async function Results({
  locale,
  sort,
  page,
}: {
  locale: string;
  sort: Sort;
  page: number;
}) {
  const t = await getTranslations('campaigns');
  const result = await fetchPage(sort, page);

  if (!result.ok) {
    return (
      <Card large>
        <div className="stack center">
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{t('error.title')}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t('error.body')}
          </p>
          <div className="center">
            {/* Full reload — a soft nav to the same URL may be served from
                the router cache, which would just repeat the failure. */}
            <a
              className="btn btn-primary btn-sm"
              href={`/${locale}${listHref(sort, page)}`}
            >
              {t('error.retry')}
            </a>
          </div>
        </div>
      </Card>
    );
  }

  const { campaigns, total } = result;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (campaigns.length === 0) {
    return (
      <Card large>
        <div className="stack center">
          <p className="muted" style={{ margin: 0 }}>
            {t('list.emptyBody')}
          </p>
          <div className="center">
            <Button href="/start" variant="primary" size="sm">
              {t('list.emptyCta')}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <CampaignGrid count={campaigns.length}>
        {campaigns.map((c) => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
      </CampaignGrid>

      {pageCount > 1 ? (
        <nav
          className="row-between wrap"
          aria-label={t('list.pageOf', { page, total: pageCount })}
          style={{ marginTop: '2rem' }}
        >
          {page > 1 ? (
            <Button href={listHref(sort, page - 1)} variant="ghost" size="sm">
              {t('list.prev')}
            </Button>
          ) : (
            <span />
          )}
          <span className="small muted">
            {t('list.pageOf', { page, total: pageCount })}
          </span>
          {page < pageCount ? (
            <Button href={listHref(sort, page + 1)} variant="ghost" size="sm">
              {t('list.next')}
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
