'use client';

import { useState } from 'react';

/**
 * WhatsApp share + copy-link pair for the highest-intent sharing moment (right
 * after someone has contributed). Copy is passed in already translated so this
 * stays a dumb client component.
 */
export function ShareSupport({
  shareUrl,
  whatsappText,
  whatsappLabel,
  copyLabel,
  copiedLabel,
}: {
  shareUrl: string;
  whatsappText: string;
  whatsappLabel: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked (insecure context / permission): leave the visible
      // link in place so the supporter can still select and copy it manually.
      setCopied(false);
    }
  }

  return (
    <div className="stack" style={{ gap: '0.75rem' }}>
      <div className="row wrap" style={{ gap: '0.5rem' }}>
        <a
          className="btn btn-primary"
          href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {whatsappLabel}
        </a>
        <button type="button" className="btn btn-ghost" onClick={copy}>
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <p className="small muted" style={{ margin: 0, wordBreak: 'break-all' }}>
        <bdi>{shareUrl}</bdi>
      </p>
      {/* Announce the copy outcome for screen readers. */}
      <span aria-live="polite" className="hint">
        {copied ? copiedLabel : ''}
      </span>
    </div>
  );
}
