'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './campaign.module.css';

/**
 * Sharing a fundraiser is the single highest-leverage action a visitor can take
 * who can't give money. Native share sheet where the browser has one (mobile
 * Safari/Chrome), otherwise a WhatsApp deep link — the dominant channel for our
 * Pakistani/diaspora audience — plus copy-link as the universal fallback.
 */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const t = useTranslations('campaigns.detail.share');
  // Feature-detected after mount: `navigator` doesn't exist during SSR, and
  // branching on it during render would cause a hydration mismatch.
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const message = t('message', { title });
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`;

  async function shareNative() {
    try {
      await navigator.share({ title, text: message, url });
    } catch {
      // Cancelled or unsupported — nothing to report, the other options remain.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked (insecure context / permissions): select the URL so
      // the visitor can copy it by hand.
      window.prompt(t('copy'), url);
    }
  }

  return (
    <div className={styles.share}>
      <span className={styles.shareLabel}>{t('label')}</span>
      {canShare && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={shareNative}>
          {t('native')}
        </button>
      )}
      <a
        className="btn btn-ghost btn-sm"
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('whatsapp')}
      </a>
      <button type="button" className="btn btn-ghost btn-sm" onClick={copyLink}>
        {t('copy')}
      </button>
      <span className={styles.shareStatus} role="status" aria-live="polite">
        {copied ? t('copied') : ''}
      </span>
    </div>
  );
}
