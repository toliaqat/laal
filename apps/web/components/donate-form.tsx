'use client';

import { useState } from 'react';
import { startDonation } from '@/app/actions/donations';

const PRESETS = [10, 25, 50, 100];

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

  // The amount sent is the custom value when present, else the selected chip.
  const effectiveAmount = custom.trim() ? custom : String(selected);

  return (
    <form
      action={startDonation}
      style={{ display: 'grid', gap: '1rem', maxWidth: 480 }}
    >
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="campaignTitle" value={campaignTitle} />
      {/* Canonical amount the server reads (preset selection). */}
      <input type="hidden" name="amount" value={effectiveAmount} />

      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
          Choose an amount
        </legend>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {PRESETS.map((p) => {
            const active = !custom.trim() && selected === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setSelected(p);
                  setCustom('');
                }}
                aria-pressed={active}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  border: active ? '2px solid #1a1a1a' : '1px solid #ccc',
                  background: active ? '#1a1a1a' : '#fff',
                  color: active ? '#fff' : '#1a1a1a',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {sym}
                {p}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label style={{ display: 'grid', gap: '0.25rem' }}>
        <span style={{ fontWeight: 600 }}>Or enter a custom amount</span>
        <input
          name="customAmount"
          inputMode="decimal"
          type="number"
          min="1"
          step="0.01"
          placeholder={`${sym}0.00`}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: 8,
            border: '1px solid #ccc',
            fontSize: '1rem',
          }}
        />
      </label>

      <label style={{ display: 'grid', gap: '0.25rem' }}>
        <span style={{ fontWeight: 600 }}>Your name (optional)</span>
        <input
          name="donorName"
          type="text"
          autoComplete="name"
          placeholder="Jane Doe"
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: 8,
            border: '1px solid #ccc',
            fontSize: '1rem',
          }}
        />
      </label>

      <label style={{ display: 'grid', gap: '0.25rem' }}>
        <span style={{ fontWeight: 600 }}>Email (optional, for your receipt)</span>
        <input
          name="donorEmail"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: 8,
            border: '1px solid #ccc',
            fontSize: '1rem',
          }}
        />
      </label>

      <label
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <input name="isAnonymous" type="checkbox" />
        <span>Donate anonymously</span>
      </label>

      <label style={{ display: 'grid', gap: '0.25rem' }}>
        <span style={{ fontWeight: 600 }}>
          Leave a message of condolence (optional)
        </span>
        <textarea
          name="message"
          rows={3}
          maxLength={450}
          placeholder="A few words for the family…"
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: 8,
            border: '1px solid #ccc',
            fontSize: '1rem',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </label>

      <button
        type="submit"
        style={{
          padding: '0.75rem 1.25rem',
          borderRadius: 8,
          border: 'none',
          background: '#1a1a1a',
          color: '#fff',
          fontWeight: 700,
          fontSize: '1rem',
          cursor: 'pointer',
        }}
      >
        Donate {sym}
        {effectiveAmount}
      </button>
    </form>
  );
}
