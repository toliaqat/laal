import 'server-only';

import sharp from 'sharp';
import { ActionError } from '@/lib/action-result';
import {
  coverImageKey,
  coverKeyFromUrl,
  deletePublicObject,
  publicCoverUrl,
  uploadPublicObject,
} from '@/lib/r2';

/**
 * Campaign cover ("hero") images. These are PUBLIC, so every byte an organizer
 * sends is re-encoded server-side before storage. Re-encoding:
 *   - strips EXIF/GPS metadata (a death/repatriation context — location leaks
 *     matter) by not carrying metadata through sharp,
 *   - neutralizes malicious payloads hidden in image containers,
 *   - normalizes to a sensible size and format (WebP).
 * The browser preview is convenience only; this module is the source of truth.
 */

// Generous cap: the client downscales before upload, so this only catches
// files that bypassed it. Must stay below serverActions.bodySizeLimit (25mb)
// so this friendly check fires before the framework's 413.
const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_DIMENSION = 1600;

/** True if the form field holds a non-empty file. */
export function hasCoverFile(value: FormDataEntryValue | null): boolean {
  return value instanceof File && value.size > 0;
}

/**
 * Validate a cover-image upload by type and size, throwing a recoverable
 * {@link ActionError} (converted to an inline form message by runAction) if it
 * is unusable. Call this BEFORE any expensive work (e.g. creating the
 * campaign) so a bad file fails fast. Returns the validated File.
 */
export function assertValidCoverFile(value: FormDataEntryValue | null): File {
  if (!(value instanceof File) || value.size === 0) {
    throw new ActionError('cover_missing');
  }
  if (value.size > MAX_BYTES) {
    throw new ActionError('cover_too_large', {
      maxMb: Math.floor(MAX_BYTES / (1024 * 1024)),
    });
  }
  if (!ALLOWED.includes(value.type)) {
    throw new ActionError('cover_invalid_type');
  }
  return value;
}

/**
 * Re-encode, resize, and upload a cover image to the public bucket. Returns the
 * stable public URL to store in campaigns.cover_image_url. Caller must have
 * authorized the upload (campaign ownership).
 */
export async function uploadCoverImage(
  campaignId: string,
  file: File,
): Promise<string> {
  const input = Buffer.from(await file.arrayBuffer());
  const output = await sharp(input)
    .rotate() // apply EXIF orientation, then drop all metadata
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();

  const key = coverImageKey(campaignId);
  await uploadPublicObject(key, output, 'image/webp');
  return publicCoverUrl(key);
}

/** Best-effort delete of a previously stored cover image by its public URL. */
export async function deleteCoverImage(
  url: string | null | undefined,
): Promise<void> {
  if (!url) return;
  const key = coverKeyFromUrl(url);
  if (key) await deletePublicObject(key).catch(() => {});
}
