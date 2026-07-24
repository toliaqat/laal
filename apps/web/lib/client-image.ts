/**
 * Client-side image downscaling for uploads. Phone cameras produce 10–15MB
 * JPEGs; the server re-encodes covers to ≤1600px WebP anyway, so shrinking on
 * the client makes uploads fast on weak connections and keeps requests far
 * below the server-action body limit. Re-encoding through a canvas also drops
 * EXIF/GPS metadata — same privacy stance as the server pipeline, which
 * remains the source of truth for whatever actually arrives.
 */

const MAX_DIMENSION = 1600;
const QUALITY = 0.85;

/** Best-effort decode across browsers; null when the image can't be decoded. */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path (older Safari quirks).
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Downscale and re-encode an image to ≤{@link MAX_DIMENSION}px JPEG. Returns
 * null when anything fails (undecodable file, canvas unavailable) — callers
 * must then submit the original and let the server validation decide.
 */
export async function downscaleImage(file: File): Promise<File | null> {
  try {
    const source = await decode(file);
    if (!source) return null;

    const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
    const height =
      'naturalHeight' in source ? source.naturalHeight : source.height;
    if (!width || !height) return null;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    if ('close' in source) source.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );
    if (!blob) return null;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return null;
  }
}
