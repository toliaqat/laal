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
const VERSION = 'v1';

export type DemoVideo = {
  /** Full walkthrough, 1080p, with sound. */
  src: string;
  /** Silent 15s loop played inline in the hero card. */
  teaser: string;
  /** Poster frame (local, in public/). */
  poster: string;
};

export function demoVideo(): DemoVideo | null {
  const base = R2_PUBLIC_BASE_URL_IF_SET();
  if (!base) return null;
  return {
    src: `${base}/site/demo/laal-demo-1080p.${VERSION}.mp4`,
    teaser: `${base}/site/demo/laal-demo-teaser.${VERSION}.mp4`,
    poster: '/demo/laal-demo-poster.jpg',
  };
}
