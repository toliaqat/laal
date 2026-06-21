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
  R2_SECRET_ACCESS_KEY,
} from '@/lib/env';

/**
 * Cloudflare R2 storage (S3-compatible). Used for private verification
 * documents. R2 has no public bucket access here — uploads go through our
 * server (we authorize first), and reads are short-lived presigned GET URLs.
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
