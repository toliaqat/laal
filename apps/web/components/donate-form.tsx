'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FormAlert } from '@/components/form';
import { startDonation } from '@/app/actions/donations';

const PRESETS = [10, 25, 50];
const MAX_DONATION = 50; // launch cap — keep in sync with app/actions/donations.ts

function symbolFor(currency: string): string {
  switch (currency.toUpperCase()) {
    case 'EUR':
      return '€';
    case 'USD':
      return '$';
    case 'GBP':
      return '£';
    default:
      return '';
  }
}

export function DonateForm({
  campaignId,
  slug,
  currency,
  campaignTitle,
}: {
  campaignId: string;
  slug: string;
  currency: string;
  campaignTitle: string;
}) {
  const t = useTranslations('campaigns');
  const [state, formAction, pending] = useActionState(startDonation, null);
  // Restore typed input after a failed submit (React resets the form).
  const fields = (state && !state.ok && state.fields) || {};
  const [selected, setSelected] = useState<number>(25);
  const [custom, setCustom] = useState<string>('');
  const sym = symbolFor(currency);

  const tierCopy: Record<number, string> = {
    10: t('donate.tier10'),
    25: t('donate.tier25'),
    50: t('donate.tier50'),
  };

  const effectiveAmount = custom.trim() ? custom : String(selected);
  const numeric = Number.parseFloat(effectiveAmount);
  const overCap = Number.isFinite(numeric) && numeric > MAX_DONATION;
  const invalid = !Number.isFinite(numeric) || numeric < 1 || overCap;

  return (
    <form action={formAction} className="stack" style={{ gap: '1rem' }}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="campaignTitle" value={campaignTitle} />
      <input type="hidden" name="amount" value={effectiveAmount} />

      <div>
        <div className="label" style={{ marginBottom: '0.5rem' }}>
          {t('donate.chooseHelp')}{' '}
          <span className="hint">
            {t('donate.upToCap', { cap: `${sym}${MAX_DONATION}` })}
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
                {sym}
                {p}
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
        <label className="label">{t('donate.customLabel')}</label>
        <input
          name="customAmount"
          className="input"
          inputMode="decimal"
          type="number"
          min="1"
          max={MAX_DONATION}
          step="1"
          placeholder={`${sym}0`}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        {overCap ? (
          <span className="error-text">
            {t('donate.overCap', { cap: `${sym}${MAX_DONATION}` })}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label className="label">{t('donate.nameLabel')}</label>
        <input
          name="donorName"
          className="input"
          type="text"
          autoComplete="name"
          placeholder={t('donate.namePlaceholder')}
          defaultValue={fields.donorName}
        />
      </div>

      <div className="field">
        <label className="label">{t('donate.emailLabel')}</label>
        <input
          name="donorEmail"
          className="input"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          defaultValue={fields.donorEmail}
        />
      </div>

      <label className="row" style={{ gap: '0.5rem' }}>
        <input name="isAnonymous" type="checkbox" />
        <span>{t('donate.anonymous')}</span>
      </label>

      <div className="field">
        <label className="label">{t('donate.messageLabel')}</label>
        <textarea
          name="message"
          className="textarea"
          maxLength={450}
          placeholder={t('donate.messagePlaceholder')}
          defaultValue={fields.message}
        />
      </div>

      <FormAlert state={state} />

      <button
        type="submit"
        className="btn btn-primary btn-block"
        disabled={invalid || pending}
      >
        {pending
          ? t('donate.submitting')
          : invalid
            ? t('donate.submit')
            : t('donate.submitWithAmount', { amount: `${sym}${effectiveAmount}` })}
      </button>
    </form>
  );
}
