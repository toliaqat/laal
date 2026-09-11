import type { ReactNode } from 'react';
import { monogram } from '@/lib/monogram';
import { MemorialPhotoImage } from './memorial-photo-image';

/**
 * Every place a fundraiser appears shows the same face (or the same initials).
 * Portraits are 7:9, passport-style — uploads are cropped to that frame — with
 * a round avatar for dense admin tables. Each box is fixed in CSS
 * (`.memorial-photo-*` in app/globals.css) so the `sizes` hint below describes
 * exactly what is painted, and a 63px thumbnail never downloads a card-width
 * image. Keep the two in step.
 *
 * - `avatar` 32px circle — admin tables.
 * - `sm`     63×81 — dashboard cards, the thank-you page.
 * - `md`     84×108, 98×126 from 640px — the browse card.
 * - `lg`     154×198, 196×252 from 640px — the fundraiser page.
 */
export type MemorialPhotoSize = 'avatar' | 'sm' | 'md' | 'lg';

const SIZES: Record<MemorialPhotoSize, string> = {
  avatar: '32px',
  sm: '63px',
  md: '(min-width: 640px) 98px, 84px',
  lg: '(min-width: 640px) 196px, 154px',
};

/**
 * The photo of the person a fundraiser remembers — or, when the family has not
 * shared one, a dignified monogram of their name on the soft accent ground,
 * filling the same frame. Some families will not have or want to share a
 * photo; the fallback is meant to look intended, never like something missing.
 *
 * Photos use `object-fit: cover` biased to the upper third (`50% 30%`), so a
 * face in an older, non-portrait photo still lands in frame; new uploads
 * arrive already framed at 7:9.
 *
 * `alt` is the caller's already-translated text and must describe the PERSON
 * ("Photo of {name}", `start.cover.photoOfAlt`), never repeat the fundraiser
 * title. Pass `''` where it would only repeat adjacent text. The monogram is
 * always `aria-hidden` — the name is in the surrounding text.
 *
 * A server-safe component with no hooks, so it renders from pages, server
 * components and client components alike. Only the photo itself is a client
 * component ({@link MemorialPhotoImage}), so that a photo which fails to load
 * falls back to the initials instead of a broken-image icon.
 */
export function MemorialPhoto({
  name,
  photoUrl,
  alt,
  size = 'md',
  priority,
}: {
  /** The deceased's name (`campaigns.deceased_name`) — source of the initials. */
  name: string;
  /** `campaigns.cover_image_url`; null/blank renders the monogram. */
  photoUrl?: string | null;
  /** Translated description of the person; `''` if decorative in context. */
  alt: string;
  size?: MemorialPhotoSize;
  /** Preload it — only for an above-the-fold, likely-LCP image. */
  priority?: boolean;
}): ReactNode {
  const src = photoUrl?.trim() || null;

  // `.ugc`: the initials come from a user-supplied name, so a Latin name on an
  // Urdu page resolves its own direction.
  const initials = (
    <span aria-hidden className="memorial-photo-monogram ugc">
      {monogram(name)}
    </span>
  );

  return (
    <span className={`memorial-photo memorial-photo-${size}`}>
      {src ? (
        <MemorialPhotoImage
          key={src}
          src={src}
          alt={alt}
          sizes={SIZES[size]}
          priority={priority}
          fallback={initials}
        />
      ) : (
        initials
      )}
    </span>
  );
}
