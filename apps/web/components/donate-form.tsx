'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FormAlert } from '@/components/form';
import { Alert, formatMoney } from '@/components/ui';
import { startDonation } from '@/app/actions/donations';

const PRESETS = [10, 25, 50];
const MIN_DONATION = 1;
const MAX_DONATION = 50; // launch cap — keep in sync with app/actions/donations.ts
const MESSAGE_MAX = 450;

export function DonateForm({
  campaignId,
  currency,
}: {
  campaignId: string;
  /** Kept for the campaign page's call signature; URLs come from the server. */
  slug?: string;
  currency: string;
  campaignTitle?: string;
}) {
  const t = useTranslations('campaigns');
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(startDonation, null);
  // Restore typed input after a failed submit (React resets the form).
  const fields = (state && !state.ok && state.fields) || {};
  const [selected, setSelected] = useState<number>(25);
  const [custom, setCustom] = useState<string>('');
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [fromApp, setFromApp] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  const headingId = useId();
  const amountGroupId = useId();
  const customId = useId();
  const customHintId = useId();
  const overCapId = useId();
  const nameId = useId();
  const nameHintId = useId();
  const emailId = useId();
  const anonymousId = useId();
  const messageId = useId();
  const messageHintId = useId();
  const submitHintId = useId();

  const money = (amount: number) => formatMoney(amount, currency, locale);
  const cap = money(MAX_DONATION);

  const tierCopy: Record<number, string> = {
    10: t('donate.tier10'),
    25: t('donate.tier25'),
    50: t('donate.tier50'),
  };

  const effectiveAmount = custom.trim() ? custom.trim() : String(selected);
  const numeric = Number(effectiveAmount);
  const isWhole = Number.isInteger(numeric);
  const overCap = Number.isFinite(numeric) && numeric > MAX_DONATION;
  const invalid =
    !Number.isFinite(numeric) || !isWhole || numeric < MIN_DONATION || overCap;

  // Restore the checkbox and message after a failed submit. Both are controlled
  // (the checkbox gates the name field, the message drives the counter), so the
  // generic defaultValue echo can't do it for us.
  useEffect(() => {
    if (state && !state.ok && state.fields) {
      setAnonymous(state.fields.isAnonymous === 'on');
      setMessage(state.fields.message ?? '');
    }
  }, [state]);

  // Move focus to the failure alert so screen-reader and keyboard users learn
  // about it instead of being left at the (unchanged) submit button.
  useEffect(() => {
    if (state && !state.ok) alertRef.current?.focus();
  }, [state]);

  // Cancelling Stripe Checkout returns to `?checkout=cancelled#help`. Read it
  // from the URL after hydration rather than via useSearchParams, which would
  // opt the whole campaign page out of static rendering.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setCancelled(query.get('checkout') === 'cancelled');
    // Carried through Stripe so the thank-you page can offer the way back
    // into the app the supporter came from.
    setFromApp(query.get('from') === 'app');
  }, []);

  return (
    // #help is the anchor the campaign page and the cancel URL link to.
    <div id="help" className="stack" style={{ gap: '1rem' }}>
      <div>
        <h2 id={headingId} style={{ margin: 0 }}>
          {t('donate.heading')}
        </h2>
        <p className="hint" style={{ marginTop: '0.35rem' }}>
          {t('donate.headingHint')}
        </p>
      </div>

      {cancelled ? <Alert tone="info">{t('donate.cancelled')}</Alert> : null}

      <form
        action={formAction}
        className="stack"
        style={{ gap: '1rem' }}
        aria-labelledby={headingId}
      >
        <input type="hidden" name="campaignId" value={campaignId} />
        <input type="hidden" name="amount" value={effectiveAmount} />
        {fromApp ? <input type="hidden" name="from" value="app" /> : null}

        <div role="group" aria-labelledby={amountGroupId}>
          <div id={amountGroupId} className="label" style={{ marginBottom: '0.5rem' }}>
            {t('donate.chooseHelp')}{' '}
            <span className="hint">
              {t('donate.upToCap', { cap })}
            </span>
          </div>
          <div className="row wrap">
            {PRESETS.map((p) => {
              const active = !custom.trim() && selected === p;
              return (
                <button
                  key={p}
                  type="button"
                  className={`btn ${active ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => {
                    setSelected(p);
                    setCustom('');
                  }}
                  aria-pressed={active}
                >
                  <bdi>{money(p)}</bdi>
                </button>
              );
            })}
          </div>
          {!custom.trim() && tierCopy[selected] ? (
            <p className="hint" style={{ marginTop: '0.5rem' }}>
              {tierCopy[selected]}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label className="label" htmlFor={customId}>
            {t('donate.customLabel')}
          </label>
          <input
            id={customId}
            name="customAmount"
            className="input"
            // Whole units only for launch: an integer pattern keeps the mobile
            // keypad numeric without the untranslated `type=number` tooltip.
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="0"
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))}
            aria-invalid={overCap || undefined}
            aria-describedby={
              overCap ? `${overCapId} ${customHintId}` : customHintId
            }
          />
          <span className="hint" id={customHintId}>
            {t('donate.customHint', { cap })}
          </span>
          {overCap ? (
            <span className="error-text" id={overCapId}>
              {t('donate.overCap', { cap })}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label className="label" htmlFor={nameId}>
            {t('donate.nameLabel')}
          </label>
          <input
            id={nameId}
            name="donorName"
            className="input"
            type="text"
            autoComplete="name"
            placeholder={t('donate.namePlaceholder')}
            defaultValue={fields.donorName}
            disabled={anonymous}
            aria-describedby={nameHintId}
          />
          <span className="hint" id={nameHintId}>
            {t('donate.nameHint')}
          </span>
        </div>

        <div className="field">
          <label className="label" htmlFor={emailId}>
            {t('donate.emailLabel')}
          </label>
          <input
            id={emailId}
            name="donorEmail"
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={fields.donorEmail}
          />
        </div>

        <div className="row" style={{ gap: '0.5rem' }}>
          <input
            id={anonymousId}
            name="isAnonymous"
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
          />
          <label htmlFor={anonymousId}>{t('donate.anonymous')}</label>
        </div>

        <div className="field">
          <label className="label" htmlFor={messageId}>
            {t('donate.messageLabel')}
          </label>
          <textarea
            id={messageId}
            name="message"
            className="textarea"
            maxLength={MESSAGE_MAX}
            placeholder={t('donate.messagePlaceholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            aria-describedby={messageHintId}
          />
          <span className="hint" id={messageHintId}>
            {t('donate.messagePublic')}{' '}
            {t('donate.messageCounter', {
              count: message.length,
              max: MESSAGE_MAX,
            })}
          </span>
        </div>

        <div ref={alertRef} tabIndex={-1}>
          <FormAlert state={state} />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={invalid || pending}
          aria-describedby={invalid ? submitHintId : undefined}
        >
          {pending ? (
            t('donate.submitting')
          ) : invalid ? (
            t('donate.submit')
          ) : (
            <>
              {t('donate.submit')} · <bdi>{money(numeric)}</bdi>
            </>
          )}
        </button>
        {/* Always rendered (not just when disabled) so the reason is announced
            the moment the button becomes unavailable. */}
        <span
          id={submitHintId}
          className="hint"
          hidden={!invalid}
          aria-hidden={!invalid}
        >
          {t('donate.submitDisabledReason', {
            min: money(MIN_DONATION),
            max: cap,
          })}
        </span>

        <div className="trust-line">
          <span className="trust-item">{t('donate.trustSecure')}</span>
          <span className="trust-item">{t('donate.trustFee')}</span>
          <span className="trust-item">{t('donate.trustReviewed')}</span>
        </div>
      </form>
    </div>
  );
}
