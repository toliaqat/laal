import 'server-only';

import { R2_PUBLIC_BASE_URL_IF_SET } from '@/lib/env';

/**
 * The product walkthrough shown in the landing-page hero.
 *
 * The full video and its muted teaser loop are large, so they live in the
 * public R2 bucket (uploaded by `demo-video/pipeline/publish.sh`), not in the
 * repo. The poster is small and ships in `public/` so the hero still paints
 * instantly — and correctly — while the video is fetched.
 *
 * Returns null where the public bucket is not configured (a build without
 * secrets, a self-hoster without R2): the hero then falls back to the phone
 * illustration rather than rendering a broken player.
 *
 * Bump VERSION whenever the video is re-published: the objects are served
 * with a one-year immutable cache, so the name must change for viewers to see
 * the new cut. Keep in sync with publish.sh.
 */
const VERSION = 'v3';

export type DemoVideo = {
  /** Full walkthrough, 1080p, with sound. */
  src: string;
  /** Silent 15s loop played inline in the hero card. */
  teaser: string;
  /** Poster frame (local, in public/). */
  poster: string;
};

/** Locales that have their own narrated cut; others fall back to English. */
const EDITIONS = new Set(['en', 'ur']);

export function demoVideo(locale: string): DemoVideo | null {
  const base = R2_PUBLIC_BASE_URL_IF_SET();
  if (!base) return null;
  // Each edition is a separate set of files, so a visitor downloads only the
  // language they are looking at (the hero fetches the poster and the small
  // teaser; the full film loads on play).
  const sfx = EDITIONS.has(locale) && locale !== 'en' ? `-${locale}` : '';
  return {
    src: `${base}/site/demo/laal-demo${sfx}-1080p.${VERSION}.mp4`,
    teaser: `${base}/site/demo/laal-demo${sfx}-teaser.${VERSION}.mp4`,
    poster: `/demo/laal-demo${sfx}-poster.jpg`,
  };
}
