/**
 * Client-side rendering of the portrait crop for cover-photo uploads. Phone
 * cameras produce 10–15MB JPEGs; the organizer frames the photo in the
 * cropper, and we render exactly that framed region ONCE, straight to the
 * final 7:9 size (no downscale-then-crop, so no double resampling). The result
 * is a few hundred KB, which keeps uploads fast on weak connections and far
 * below the server-action body limit. Re-encoding through a canvas also drops
 * EXIF/GPS metadata — same privacy stance as the server pipeline
 * (lib/cover-image.ts), which remains the source of truth for whatever
 * actually arrives and cover-crops anything that is not already 7:9.
 */

import {
  PORTRAIT_SIZE,
  computePortraitCrop,
  type Point,
} from '@/lib/portrait-crop';

const QUALITY = 0.9;

type Decoded = { source: CanvasImageSource; width: number; height: number; close(): void };

/**
 * Best-effort decode across browsers, EXIF orientation applied, so a phone
 * photo taken sideways comes out upright. `imageOrientation: 'from-image'`
 * is the spec default, but older engines defaulted to ignoring EXIF, so we ask
 * for it explicitly. The <img> fallback is also upright: every current engine
 * applies EXIF orientation when drawing an image element (CSS
 * `image-orientation: from-image` is the default). Both paths therefore
 * report the same upright width/height as the <img> the cropper displays.
 */
async function decode(file: Blob): Promise<Decoded | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> path (older Safari quirks).
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        close: () => {},
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Render the framed region of `file` to a {@link PORTRAIT_SIZE} JPEG. `zoom`
 * and `pan` are the cropper's state (see lib/portrait-crop.ts; pan is in
 * portrait-frame units, so it is independent of the photo's resolution).
 * Returns null when anything fails (undecodable file, canvas unavailable) —
 * callers must then submit the original and let the server crop it.
 */
export async function renderPortrait(
  file: File,
  { zoom, pan }: { zoom: number; pan: Point },
): Promise<File | null> {
  let decoded: Decoded | null = null;
  try {
    decoded = await decode(file);
    if (!decoded || !decoded.width || !decoded.height) return null;

    const { source } = computePortraitCrop({
      image: { width: decoded.width, height: decoded.height },
      frame: PORTRAIT_SIZE,
      zoom,
      pan,
    });

    const canvas = document.createElement('canvas');
    canvas.width = PORTRAIT_SIZE.width;
    canvas.height = PORTRAIT_SIZE.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      decoded.source,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );
    if (!blob) return null;

    const name = file.name.replace(/\.[^.]+$/, '') + '-portrait.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return null;
  } finally {
    decoded?.close();
  }
}
