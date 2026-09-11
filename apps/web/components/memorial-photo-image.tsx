'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';

/**
 * The photo half of {@link MemorialPhoto}, split out because falling back needs
 * an `onError` handler, which only a client component can attach.
 *
 * If the stored photo fails to load (deleted from the bucket, a bad URL, the
 * image host down), it renders `fallback` — the person's initials — instead of
 * the browser's broken-image icon. On a memorial page a broken image where a
 * loved one's face should be reads as careless; initials read as intended.
 * The mobile avatar and portrait behave the same way.
 *
 * The caller keys this by `src`, so a new URL always gets a fresh attempt.
 */
export function MemorialPhotoImage({
  src,
  alt,
  sizes,
  priority,
  fallback,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      style={{ objectFit: 'cover', objectPosition: '50% 30%' }}
      onError={() => setFailed(true)}
    />
  );
}
