'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Field } from '@/components/ui';
import { renderPortrait } from '@/lib/client-image';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  PORTRAIT_SIZE,
  computePortraitCrop,
  zoomAroundCentre,
  type Point,
  type Size,
} from '@/lib/portrait-crop';
import styles from './cover-image-input.module.css';

// Keep in sync with MAX_BYTES in lib/cover-image.ts.
const SERVER_MAX_BYTES = 20 * 1024 * 1024;

/** Frame units (of the 700x900 portrait) moved per arrow-key press. */
const KEY_STEP = 20;
const KEY_STEP_LARGE = 80;
const ZOOM_KEY_STEP = 0.1;
/** Wait this long after the last adjustment before rendering the crop. */
const EXPORT_DELAY_MS = 180;

type View = { zoom: number; pan: Point };
const INITIAL_VIEW: View = { zoom: MIN_ZOOM, pan: { x: 0, y: 0 } };

/**
 * Optional photo of the person the fundraiser is for, framed as a 7:9
 * passport-style portrait. After a photo is picked the organizer can drag it
 * (mouse, touch, pen), pinch or use the zoom slider, and nudge it with the
 * arrow keys until the face sits in the oval guide. The panning is clamped so
 * the photo always fills the frame.
 *
 * Exactly what they framed is rendered once, at the final 700x900 size
 * (lib/client-image.ts), and swapped into the file input in place of the
 * original, so a few hundred KB leave the device instead of a 10MB photo.
 * If anything fails the original is submitted and the server (which crops
 * whatever arrives to 7:9 around the most salient region) is the backstop.
 *
 * An already-stored photo (edit flow) is shown framed but is not re-croppable:
 * the image host sends no CORS headers, so it cannot be read back into a
 * canvas. "Choose a different photo" is the way to change the framing.
 */
export function CoverImageInput({
  currentUrl,
  deceasedName,
  allowRemove = false,
}: {
  /** Existing stored image (edit flow), shown until a new file is picked. */
  currentUrl?: string | null;
  deceasedName?: string;
  /** Render a "remove current photo" checkbox (edit flow only). */
  allowRemove?: boolean;
}) {
  const t = useTranslations('start');
  const format = useFormatter();

  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [smooth, setSmooth] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [remove, setRemove] = useState(false);

  // What the form should submit right now: the rendered crop once ready,
  // otherwise the original. Re-applied if React resets the form after a
  // failed submit, so the photo is never silently dropped.
  const submitFileRef = useRef<File | null>(null);
  // True while the input does not yet hold the crop for the current framing.
  const dirtyRef = useRef(false);
  // A submit held back until the crop lands (see the submit listener).
  const queuedSubmitRef = useRef<{ submitter: HTMLElement | null } | null>(null);
  const exportSeqRef = useRef(0);
  const pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);

  const alt = deceasedName
    ? t('cover.photoOfAlt', { name: deceasedName })
    : t('cover.photoAlt');

  /** Put a file into the real <input type=file> so the form submits it. */
  const setInputFile = useCallback((next: File | null) => {
    const input = inputRef.current;
    if (!input) return false;
    if (!next) {
      input.value = '';
      return true;
    }
    try {
      const dt = new DataTransfer();
      dt.items.add(next);
      input.files = dt.files;
      return true;
    } catch {
      return false; // Ancient browser: the original stays in the input.
    }
  }, []);

  /** The input is up to date: release a submit that was waiting for it. */
  const settle = useCallback(() => {
    dirtyRef.current = false;
    const queued = queuedSubmitRef.current;
    if (!queued) return;
    queuedSubmitRef.current = null;
    const form = inputRef.current?.form;
    const submitter = queued.submitter;
    form?.requestSubmit(
      submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
        ? submitter
        : undefined,
    );
  }, []);

  // Revoke object URLs when they change/unmount to avoid leaking memory.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  // Render the framed region shortly after the organizer stops adjusting.
  useEffect(() => {
    const seq = ++exportSeqRef.current; // Any older render is now stale.
    if (!file || unreadable) return;
    dirtyRef.current = true;
    if (!natural || dragging) return;
    const snapshot = view;
    const timer = window.setTimeout(async () => {
      const cropped = await renderPortrait(file, snapshot);
      if (seq !== exportSeqRef.current) return;
      if (cropped && setInputFile(cropped)) {
        submitFileRef.current = cropped;
        setExportFailed(false);
      } else {
        setExportFailed(true); // The original stays; the server crops it.
      }
      settle();
    }, EXPORT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [file, natural, view, dragging, unreadable, setInputFile, settle]);

  // Hold a submit that races an unfinished crop (it lands within moments),
  // then resubmit with the framed photo. Also restore the photo into the
  // input when React resets the form after a failed action.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;

    const onSubmit = (e: SubmitEvent) => {
      if (!dirtyRef.current) return;
      // React sees defaultPrevented and does not run the action.
      e.preventDefault();
      queuedSubmitRef.current = { submitter: e.submitter };
      // Never strand a submit: after a few seconds, send what we have.
      window.setTimeout(() => {
        if (queuedSubmitRef.current) settle();
      }, 5000);
    };
    const onReset = () => {
      // The reset runs after this event; put the photo back once it has.
      window.setTimeout(() => {
        if (submitFileRef.current) setInputFile(submitFileRef.current);
      }, 0);
    };

    form.addEventListener('submit', onSubmit);
    form.addEventListener('reset', onReset);
    return () => {
      form.removeEventListener('submit', onSubmit);
      form.removeEventListener('reset', onReset);
    };
  }, [setInputFile, settle]);

  const clampView = useCallback(
    (next: View): View => {
      if (!natural) return next;
      const crop = computePortraitCrop({
        image: natural,
        frame: PORTRAIT_SIZE,
        zoom: next.zoom,
        pan: next.pan,
      });
      return { zoom: crop.zoom, pan: crop.pan };
    },
    [natural],
  );

  function pick(next: File | null) {
    submitFileRef.current = next;
    dirtyRef.current = Boolean(next);
    setFile(next);
    setNatural(null);
    setView(INITIAL_VIEW);
    setUnreadable(false);
    setExportFailed(false);
    setUrl(next ? URL.createObjectURL(next) : null);
    if (next) setRemove(false);
  }

  function discard() {
    pick(null);
    setInputFile(null);
  }

  function reset() {
    setSmooth(true);
    setView(INITIAL_VIEW);
  }

  /** Convert a distance in screen pixels to portrait-frame units. */
  function toFrameUnits(px: number): number {
    const width = frameRef.current?.getBoundingClientRect().width || PORTRAIT_SIZE.width;
    return (px * PORTRAIT_SIZE.width) / width;
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!natural) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      pinchRef.current = {
        distance: spread([...pointersRef.current.values()]) || 1,
        zoom: view.zoom,
      };
    }
    setSmooth(false);
    setDragging(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const pointers = pointersRef.current;
    const last = pointers.get(e.pointerId);
    if (!last || !natural) return;
    const before = [...pointers.values()];
    const midBefore = midpoint(before);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const after = [...pointers.values()];
    const midAfter = midpoint(after);
    const dx = toFrameUnits(midAfter.x - midBefore.x);
    const dy = toFrameUnits(midAfter.y - midBefore.y);

    setView((prev) => {
      let next: View = { zoom: prev.zoom, pan: { x: prev.pan.x + dx, y: prev.pan.y + dy } };
      const pinch = pinchRef.current;
      if (pinch && after.length >= 2) {
        next = zoomAroundCentre(
          natural,
          PORTRAIT_SIZE,
          next,
          (pinch.zoom * spread(after)) / pinch.distance,
        );
      }
      return clampView(next);
    });
  }

  function onPointerEnd(e: PointerEvent<HTMLDivElement>) {
    const pointers = pointersRef.current;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchRef.current = null;
    if (pointers.size === 0) setDragging(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!natural) return;
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    // Arrows move the photo in the direction pressed (physical, as when
    // dragging), so they mean the same thing in English and Urdu.
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      setSmooth(true);
      setView((prev) =>
        clampView({ zoom: prev.zoom, pan: { x: prev.pan.x + move.x, y: prev.pan.y + move.y } }),
      );
      return;
    }
    if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
      e.preventDefault();
      const delta = e.key === '+' || e.key === '=' ? ZOOM_KEY_STEP : -ZOOM_KEY_STEP;
      setSmooth(true);
      setView((prev) => zoomAroundCentre(natural, PORTRAIT_SIZE, prev, prev.zoom + delta));
    }
  }

  // Where the photo sits inside the frame, as percentages so the frame can be
  // any on-screen size.
  const crop = natural
    ? computePortraitCrop({ image: natural, frame: PORTRAIT_SIZE, zoom: view.zoom, pan: view.pan })
    : null;
  const photoStyle = crop
    ? {
        left: `${(crop.display.x / PORTRAIT_SIZE.width) * 100}%`,
        top: `${(crop.display.y / PORTRAIT_SIZE.height) * 100}%`,
        width: `${(crop.display.width / PORTRAIT_SIZE.width) * 100}%`,
        height: `${(crop.display.height / PORTRAIT_SIZE.height) * 100}%`,
      }
    : // Until the size is known, show it centred and covering.
      { inset: 0, width: '100%', height: '100%', objectFit: 'cover' as const };

  const cropping = Boolean(file && url && !unreadable);
  const stored = !file && !remove ? currentUrl ?? null : null;
  const tooLarge = Boolean(file && (exportFailed || unreadable) && file.size > SERVER_MAX_BYTES);

  const instructionsId = 'cover_image_instructions';
  const zoomId = 'cover_image_zoom';

  return (
    <Field label={t('cover.label')} hint={t('cover.hint')}>
      <div className="stack" style={{ gap: '0.75rem' }}>
        {cropping && (
          <>
            <p id={instructionsId} className={styles.instructions}>
              {t('cover.cropInstructions')}
            </p>

            <div
              ref={frameRef}
              className={`${styles.frame}${dragging ? ` ${styles.dragging}` : ''}`}
              role="group"
              aria-label={t('cover.cropFrameLabel')}
              aria-describedby={instructionsId}
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              onLostPointerCapture={onPointerEnd}
              onKeyDown={onKeyDown}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img
                src={url!}
                alt={alt}
                draggable={false}
                className={`${styles.photo}${smooth ? ` ${styles.smooth}` : ''}`}
                style={photoStyle}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth && img.naturalHeight) {
                    setNatural({ width: img.naturalWidth, height: img.naturalHeight });
                  }
                }}
                onError={() => {
                  // Can't frame it here; the original goes as-is and the
                  // server crops it around the most salient region.
                  setUnreadable(true);
                  settle();
                }}
              />
              <div className={styles.guide} aria-hidden="true" />
            </div>

            <div className={styles.zoomRow}>
              <label htmlFor={zoomId} className={styles.zoomLabel}>
                {t('cover.zoom')}
              </label>
              <span className={styles.zoomGlyph} aria-hidden="true">
                −
              </span>
              <input
                id={zoomId}
                type="range"
                className={styles.zoomRange}
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={view.zoom}
                aria-valuetext={format.number(view.zoom, { style: 'percent' })}
                onChange={(e) => {
                  if (!natural) return;
                  setSmooth(false);
                  const z = Number(e.target.value);
                  setView((prev) => zoomAroundCentre(natural, PORTRAIT_SIZE, prev, z));
                }}
              />
              <span className={styles.zoomGlyph} aria-hidden="true">
                +
              </span>
            </div>
          </>
        )}

        {file && unreadable && <p className={styles.note}>{t('cover.cropUnavailable')}</p>}

        {stored && (
          <>
            <div className={`${styles.frame} ${styles.static}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- stored cover on the image host */}
              <img src={stored} alt={alt} className={styles.staticPhoto} />
            </div>
            <p className={styles.note}>{t('cover.reframeHint')}</p>
          </>
        )}

        <div className={styles.actions}>
          <input
            ref={inputRef}
            id="cover_image"
            name="cover_image"
            className={styles.fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          <label htmlFor="cover_image" className={`btn btn-ghost btn-sm ${styles.chooseButton}`}>
            {file || stored ? t('cover.chooseDifferent') : t('cover.choose')}
          </label>
        </div>

        {file && (
          <div className={styles.secondaryActions}>
            {cropping && (
              <button type="button" className={styles.textButton} onClick={reset}>
                {t('cover.cropReset')}
              </button>
            )}
            <button type="button" className={styles.textButton} onClick={discard}>
              {t('cover.discard')}
            </button>
          </div>
        )}

        {tooLarge && (
          <span className="error-text">
            {t('cover.tooLarge', { maxMb: SERVER_MAX_BYTES / (1024 * 1024) })}
          </span>
        )}

        {allowRemove && currentUrl && !file && (
          <label className="row small" style={{ gap: '0.4rem' }}>
            <input
              type="checkbox"
              name="remove_cover"
              value="1"
              checked={remove}
              onChange={(e) => setRemove(e.target.checked)}
            />
            <span>{t('cover.remove')}</span>
          </label>
        )}
      </div>
    </Field>
  );
}

/** Distance between the first two pointers (for pinch-to-zoom). */
function spread(points: Point[]): number {
  const [a, b] = points;
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

function midpoint(points: Point[]): Point {
  const n = points.length || 1;
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / n,
    y: points.reduce((sum, p) => sum + p.y, 0) / n,
  };
}
