import 'server-only';

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  R2_ACCESS_KEY_ID,
  R2_ACCOUNT_ID,
  R2_BUCKET,
  R2_PUBLIC_BASE_URL,
  R2_PUBLIC_BUCKET,
  R2_SECRET_ACCESS_KEY,
} from '@/lib/env';

/**
 * Cloudflare R2 storage (S3-compatible). Two buckets, two trust models:
 *  - Private bucket (R2_BUCKET): verification documents. Uploads go through our
 *    server (we authorize first); reads are short-lived presigned GET URLs.
 *  - Public bucket (R2_PUBLIC_BUCKET): campaign cover images. Same authorized
 *    server-side upload, but objects are world-readable via R2_PUBLIC_BASE_URL
 *    so the public campaign page and social unfurlers can load them directly.
 */

let _client: S3Client | null = null;
function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID()}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID(),
        secretAccessKey: R2_SECRET_ACCESS_KEY(),
      },
    });
  }
  return _client;
}

/** Build a namespaced object key for a campaign's document. */
export function documentKey(campaignId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  // A random-ish prefix avoids collisions without needing Date/crypto here.
  const rand = Math.random().toString(36).slice(2, 10);
  return `campaigns/${campaignId}/documents/${rand}-${safe}`;
}

/** Upload bytes to R2 (server-side; caller must authorize first). */
export async function uploadObject(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Short-lived presigned GET URL for viewing/downloading a private object. */
export async function presignDownload(
  key: string,
  expiresInSeconds = 300,
): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: R2_BUCKET(), Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

/** Delete an object from R2. */
export async function deleteObject(key: string): Promise<void> {
  await client().send(
    new DeleteObjectCommand({ Bucket: R2_BUCKET(), Key: key }),
  );
}

// ---- Public bucket: campaign cover images ----

/** Build a namespaced key for a campaign's public cover image. */
export function coverImageKey(campaignId: string): string {
  // Random suffix gives each upload a fresh URL, so replacing the image is not
  // masked by CDN/browser caching of a reused key.
  const rand = Math.random().toString(36).slice(2, 10);
  return `campaigns/${campaignId}/cover/${rand}.webp`;
}

/** Stable public URL for an object in the public bucket. */
export function publicCoverUrl(key: string): string {
  return `${R2_PUBLIC_BASE_URL()}/${key}`;
}

/** Recover the object key from a public cover URL (for deletion). */
export function coverKeyFromUrl(url: string): string | null {
  const prefix = `${R2_PUBLIC_BASE_URL()}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

/** Upload bytes to the PUBLIC bucket (world-readable; caller must authorize). */
export async function uploadPublicObject(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: R2_PUBLIC_BUCKET(),
      Key: key,
      Body: body,
      ContentType: contentType,
      // Immutable: keys are random, so a stored URL always points at one image.
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}

/** Delete an object from the PUBLIC bucket. */
export async function deletePublicObject(key: string): Promise<void> {
  await client().send(
    new DeleteObjectCommand({ Bucket: R2_PUBLIC_BUCKET(), Key: key }),
  );
}
