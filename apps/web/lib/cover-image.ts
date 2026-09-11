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
 *   - normalizes to a sensible size and format (WebP),
 *   - frames it as a 7:9 (width:height) passport-style portrait, the shape it
 *     is shown in everywhere.
 * The browser cropper (components/cover-image-input.tsx) normally sends an
 * already-framed 700x900 JPEG, which passes through the resize unchanged in
 * shape. Anything else — a no-JS submit, an old client, a direct request — is
 * cover-cropped here, keeping the most salient region (usually the face).
 * The browser side is convenience only; this module is the source of truth.
 */

// Generous cap: the client downscales before upload, so this only catches
// files that bypassed it. Must stay below serverActions.bodySizeLimit (25mb)
// so this friendly check fires before the framework's 413.
const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
// Portrait output size, 7:9. Keep in sync with PORTRAIT_SIZE in
// lib/portrait-crop.ts (not imported, so this server module stays tiny).
const PORTRAIT_WIDTH = 700;
const PORTRAIT_HEIGHT = 900;

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
 * Re-encode, crop to a 7:9 portrait, and upload a cover image to the public
 * bucket. Returns the stable public URL to store in campaigns.cover_image_url.
 * Caller must have authorized the upload (campaign ownership).
 */
export async function uploadCoverImage(
  campaignId: string,
  file: File,
): Promise<string> {
  const input = Buffer.from(await file.arrayBuffer());
  const output = await sharp(input)
    .rotate() // apply EXIF orientation, then drop all metadata
    // Always exactly 700x900. `cover` fills the frame and trims the excess;
    // the attention strategy trims around the most salient region (skin
    // tones, contrast, saturation), which for a portrait is usually the face,
    // rather than blindly around the centre. Small images are enlarged so every
    // stored cover has the same shape and size; a frame the client already
    // cropped to 7:9 has nothing to trim and is only resampled.
    .resize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT, {
      fit: 'cover',
      position: sharp.strategy.attention,
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
