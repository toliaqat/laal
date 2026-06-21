'use client';

import { useState } from 'react';
import { startDonation } from '@/app/actions/donations';

const PRESETS = [10, 25, 50];
const MAX_DONATION = 50; // launch cap — keep in sync with app/actions/donations.ts

// Per-tier microcopy (Laal voice).
const TIER_COPY: Record<number, string> = {
  10: 'Provide a moment of relief',
  25: 'Create meaningful support',
  50: 'Make a lasting difference',
};

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
  const [selected, setSelected] = useState<number>(25);
  const [custom, setCustom] = useState<string>('');
  const sym = symbolFor(currency);

  const effectiveAmount = custom.trim() ? custom : String(selected);
  const numeric = Number.parseFloat(effectiveAmount);
  const overCap = Number.isFinite(numeric) && numeric > MAX_DONATION;
  const invalid = !Number.isFinite(numeric) || numeric < 1 || overCap;

  return (
    <form action={startDonation} className="stack" style={{ gap: '1rem' }}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="campaignTitle" value={campaignTitle} />
      <input type="hidden" name="amount" value={effectiveAmount} />

      <div>
        <div className="label" style={{ marginBottom: '0.5rem' }}>
          Choose how you’ll help{' '}
          <span className="hint">(up to {sym}{MAX_DONATION} for now)</span>
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
        {!custom.trim() && TIER_COPY[selected] ? (
          <p className="hint" style={{ marginTop: '0.5rem' }}>
            {TIER_COPY[selected]}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label className="label">Or enter a custom amount</label>
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
            The maximum donation is {sym}
            {MAX_DONATION} for now.
          </span>
        ) : null}
      </div>

      <div className="field">
        <label className="label">Your name (optional)</label>
        <input
          name="donorName"
          className="input"
          type="text"
          autoComplete="name"
          placeholder="Jane Doe"
        />
      </div>

      <div className="field">
        <label className="label">Email (optional, for your receipt)</label>
        <input
          name="donorEmail"
          className="input"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>

      <label className="row" style={{ gap: '0.5rem' }}>
        <input name="isAnonymous" type="checkbox" />
        <span>Support anonymously</span>
      </label>

      <div className="field">
        <label className="label">Leave a message of condolence (optional)</label>
        <textarea
          name="message"
          className="textarea"
          maxLength={450}
          placeholder="A few words for the family…"
        />
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={invalid}>
        Help Now{invalid ? '' : ` · ${sym}${effectiveAmount}`}
      </button>
    </form>
  );
}
