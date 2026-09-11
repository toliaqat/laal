'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * The hero's "watch how Laal works" card.
 *
 * At rest it is a rounded 16:9 frame playing a silent 15-second loop from the
 * walkthrough (the poster until it loads, and permanently for visitors who
 * prefer reduced motion), with a play button and a caption pill. Activating
 * it opens a native <dialog> lightbox with the full video, sound on, and
 * focus trapped by the browser. Closing (Escape, the ✕, or the backdrop)
 * stops playback so audio never continues behind the page.
 *
 * Everything the card says is in `home.video.*`; the teaser is decorative
 * (`aria-hidden`), the trigger button carries the accessible name.
 */
export function DemoVideo({
  src,
  teaser,
  poster,
}: {
  src: string;
  teaser: string;
  poster: string;
}) {
  const t = useTranslations('home.video');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const titleId = useId();
  const [motionOk, setMotionOk] = useState(false);

  // Only autoplay the teaser for people who have not asked for less motion.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionOk(!mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // play() returns a promise that rejects if the browser blocks it (it
    // won't — this follows a click), so just swallow that case.
    videoRef.current?.play().catch(() => {});
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const stop = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  }, []);

  return (
    <>
      <div className="demo-card">
        <button
          type="button"
          className="demo-trigger"
          onClick={open}
          aria-label={t('play')}
        >
          {motionOk ? (
            <video
              className="demo-teaser"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={poster}
              aria-hidden
              tabIndex={-1}
            >
              <source src={teaser} type="video/mp4" />
            </video>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="demo-teaser" src={poster} alt="" aria-hidden />
          )}
          <span className="demo-play" aria-hidden>
            <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
              <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5Z" />
            </svg>
          </span>
          <span className="demo-caption" aria-hidden>
            <strong>{t('watch')}</strong>
            <span className="demo-caption-sep">·</span>
            <span>{t('duration')}</span>
          </span>
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="demo-dialog"
        aria-labelledby={titleId}
        onClose={stop}
        // A click on the backdrop lands on the <dialog> itself, not its children.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="demo-dialog-inner">
          <h2 id={titleId} className="sr-only">
            {t('title')}
          </h2>
          <button
            type="button"
            className="demo-close"
            onClick={close}
            aria-label={t('close')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          {/* preload="none": the 15 MB file is fetched only once someone opens it. */}
          <video
            ref={videoRef}
            className="demo-player"
            controls
            playsInline
            preload="none"
            poster={poster}
          >
            <source src={src} type="video/mp4" />
          </video>
        </div>
      </dialog>
    </>
  );
}
