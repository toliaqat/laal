import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { APP_URL } from '@/lib/env';
import { stripe, toMajorUnits } from '@/lib/stripe';
import { ShareSupport } from '@/components/share-support';
import { MemorialPhoto } from '@/components/memorial-photo';
import { Container, Card, Button, formatMoney } from '@/components/ui';

type Params = { slug: string; locale: string };
type Search = { session_id?: string; from?: string };

/**
 * What we can honestly say about the money, based on the Checkout Session.
 *
 * `hasEmail` is a BOOLEAN on purpose. A `session_id` behaves as a bearer token
 * and leaks the way URL parameters always leak — browser history, a proudly
 * shared "look, I supported this" link, proxy logs, and the Referer header on
 * the WhatsApp/deep links this very page renders — while nothing at all ties
 * the viewer to the person who paid. Rendering
 * `session.customer_details.email` therefore handed a supporter's address (an
 * anonymous supporter's included) to anyone holding the link. We only need to
 * know WHETHER an address was collected, so that is all we carry.
 */
type Outcome =
  | { kind: 'paid'; amount: string; hasEmail: boolean }
  | { kind: 'pending'; hasEmail: boolean }
  | { kind: 'unknown' };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'campaigns' });
  return {
    title: t('thankYou.metaTitle'),
    robots: { index: false },
  };
}

/**
 * Resolve the Checkout Session into a claim we can stand behind.
 *
 * Without this the page asserted "your support has been received" on any visit
 * — including a bookmarked URL, and including delayed payment methods (SEPA,
 * iDEAL) that redirect here while still 'unpaid' and which the webhook
 * deliberately skips until the funds clear.
 */
async function resolveOutcome(
  sessionId: string | undefined,
  campaignId: string,
  currency: string,
  locale: string,
): Promise<Outcome> {
  if (!sessionId) return { kind: 'unknown' };

  let session;
  try {
    session = await stripe().checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error('[thank-you] could not retrieve session', err);
    return { kind: 'unknown' };
  }

  // A session from a different fundraiser must not confirm support for this one.
  if (session.metadata?.campaign_id !== campaignId) return { kind: 'unknown' };

  const hasEmail = Boolean(session.customer_details?.email);
  if (session.payment_status !== 'paid') return { kind: 'pending', hasEmail };

  const amount = toMajorUnits(session.amount_total ?? 0);
  return {
    kind: 'paid',
    amount: formatMoney(
      amount,
      (session.currency ?? currency).toUpperCase(),
      locale,
    ),
    hasEmail,
  };
}

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('campaigns');
  const ts = await getTranslations('start');
  const { session_id: sessionId, from } = await searchParams;

  const supabase = await createServerSupabase();
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, title, currency, deceased_name, cover_image_url')
    .eq('slug', slug)
    .maybeSingle();

  if (!campaign) notFound();

  const outcome = await resolveOutcome(
    sessionId,
    campaign.id,
    campaign.currency,
    locale,
  );

  const shareUrl = `${APP_URL()}/${locale}/campaigns/${slug}`;
  const title =
    outcome.kind === 'pending'
      ? t('thankYou.pendingTitle')
      : outcome.kind === 'paid'
        ? t('thankYou.title')
        : t('thankYou.neutralTitle');

  return (
    <main className="section">
      <Container narrow>
        <Card large>
          {/* One alignment for the whole card. The badge was start-aligned
              (hard left in English, hard right in Urdu) above a centred heading
              and lead, while every section below it was start-aligned — three
              alignments in one card. Start wins: it is what the rest of the
              card, and the rest of the app, already does, and it mirrors
              cleanly under RTL. */}
          <div className="stack">
            <div
              aria-hidden
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--accent)',
                color: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
              }}
            >
              ♥
            </div>
            <h1 style={{ margin: 0 }}>{title}</h1>

            {outcome.kind === 'paid' ? (
              <>
                {/* The person they just helped, quietly beside the line that
                    names their fundraiser. The row starts at the same inline
                    edge as everything else, so the card keeps its one
                    alignment, and mirrors under RTL. The bottom margin stands
                    in for the paragraph's own, keeping the rhythm unchanged. */}
                <div
                  className="row"
                  style={{ gap: '0.9rem', marginBlockEnd: '1rem' }}
                >
                  <MemorialPhoto
                    size="sm"
                    name={campaign.deceased_name}
                    photoUrl={campaign.cover_image_url}
                    alt={ts('cover.photoOfAlt', {
                      name: campaign.deceased_name,
                    })}
                  />
                  <p
                    className="muted"
                    style={{
                      fontSize: '1.05rem',
                      lineHeight: 1.7,
                      margin: 0,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {t('thankYou.paidBody', {
                      amount: outcome.amount,
                      title: campaign.title,
                    })}
                  </p>
                </div>
                <p
                  className="muted"
                  style={{ fontSize: '1.05rem', lineHeight: 1.7 }}
                >
                  {t('thankYou.body1')}{' '}
                  {outcome.hasEmail
                    ? t('thankYou.receiptSent')
                    : t('thankYou.receiptNone')}
                </p>
                <p
                  className="muted"
                  style={{ fontSize: '1.05rem', lineHeight: 1.7 }}
                >
                  {t('thankYou.body2')}
                </p>
              </>
            ) : outcome.kind === 'pending' ? (
              <p
                className="muted"
                style={{ fontSize: '1.05rem', lineHeight: 1.7 }}
              >
                {t('thankYou.pendingBody')}
              </p>
            ) : (
              <p
                className="muted"
                style={{ fontSize: '1.05rem', lineHeight: 1.7 }}
              >
                {t('thankYou.neutralBody')}
              </p>
            )}
          </div>

          {/* Sharing sits highest on the page after the confirmation: this is
              the moment a supporter is most willing to bring someone else in. */}
          <div className="stack" style={{ gap: '0.5rem', marginTop: '2rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
              {t('thankYou.shareHeading')}
            </h2>
            <p className="muted small" style={{ margin: 0 }}>
              {t('thankYou.shareBody')}
            </p>
            <ShareSupport
              shareUrl={shareUrl}
              whatsappText={t('thankYou.shareMessage', {
                title: campaign.title,
                url: shareUrl,
              })}
              whatsappLabel={t('thankYou.shareWhatsapp')}
              copyLabel={t('thankYou.copyLink')}
              copiedLabel={t('thankYou.copied')}
            />
          </div>

          <div className="stack" style={{ gap: '0.5rem', marginTop: '2rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
              {t('thankYou.nextHeading')}
            </h2>
            <ul className="stack muted small" style={{ gap: '0.35rem' }}>
              <li>{t('thankYou.next1')}</li>
              <li>{t('thankYou.next2')}</li>
              <li>{t('thankYou.next3')}</li>
            </ul>
          </div>

          <div className="row wrap" style={{ marginTop: '2rem', gap: '0.5rem' }}>
            <Button href={`/campaigns/${slug}`} variant="primary">
              {t('thankYou.returnCta')}
            </Button>
            {/* Checkout runs in the device browser when started from the app,
                so offer the way back into it. */}
            {from === 'app' ? (
              <a className="btn btn-ghost" href={`laal://campaigns/${slug}`}>
                {t('thankYou.backToApp')}
              </a>
            ) : null}
          </div>
        </Card>
      </Container>
    </main>
  );
}
