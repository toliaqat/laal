/**
 * Geometry for the passport-style portrait crop (7:9, width:height) used for
 * the photo of the person a fundraiser is for. Pure and DOM-free so the
 * browser cropper (components/cover-image-input.tsx), the canvas export
 * (lib/client-image.ts) and the unit tests all share one definition.
 *
 * Model: the image is scaled to cover the frame (zoom 1 = "just fills the
 * frame"), then multiplied by `zoom`. `pan` is the offset of the image's
 * centre from the frame's centre, in FRAME units (the same units as `frame`),
 * so it is independent of the image's resolution and of how large the frame
 * happens to be drawn on screen. Positive x moves the image right, positive y
 * moves it down — physical directions, identical in LTR and RTL.
 */

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

/** Portrait aspect ratio, width / height. */
export const PORTRAIT_ASPECT = 7 / 9;

/**
 * Canonical frame and export size. The cropper works in these units and the
 * canvas export renders at exactly this size; the server resizes to the same.
 * Keep in sync with PORTRAIT_WIDTH/PORTRAIT_HEIGHT in lib/cover-image.ts.
 */
export const PORTRAIT_SIZE: Size = { width: 700, height: 900 };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

/** Clamp a zoom factor into [MIN_ZOOM, MAX_ZOOM]; non-finite becomes 1. */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Frame units per image pixel at zoom 1 — the smallest scale that covers. */
export function coverScale(image: Size, frame: Size): number {
  return Math.max(frame.width / image.width, frame.height / image.height);
}

/** Largest |pan| on each axis that still keeps the frame fully covered. */
export function maxPan(image: Size, frame: Size, zoom: number): Point {
  const scale = coverScale(image, frame) * clampZoom(zoom);
  return {
    x: Math.max(0, (image.width * scale - frame.width) / 2),
    y: Math.max(0, (image.height * scale - frame.height) / 2),
  };
}

function clamp(value: number, limit: number): number {
  if (!Number.isFinite(value)) return 0;
  // `+ 0` turns -0 into 0 so callers (and tests) never see a negative zero.
  return Math.min(limit, Math.max(-limit, value)) + 0;
}

/** Clamp a pan so no empty edge can show at the given zoom. */
export function clampPan(
  image: Size,
  frame: Size,
  zoom: number,
  pan: Point,
): Point {
  const limit = maxPan(image, frame, zoom);
  return { x: clamp(pan.x, limit.x), y: clamp(pan.y, limit.y) };
}

export type PortraitCrop = {
  /** Zoom after clamping into [MIN_ZOOM, MAX_ZOOM]. */
  zoom: number;
  /** Pan after clamping (frame units). */
  pan: Point;
  /** Frame units per image pixel. */
  scale: number;
  /** The image's drawn rectangle, in frame units relative to the frame's top-left. */
  display: Rect;
  /** The region of the source image (image pixels) that fills the frame. */
  source: Rect;
};

/**
 * Resolve a zoom + pan into everything needed to draw or export the crop:
 * the clamped state, where the image sits in the frame, and the source
 * rectangle to copy from the image. The source rectangle always lies inside
 * the image and always has the frame's aspect ratio.
 */
export function computePortraitCrop({
  image,
  frame = PORTRAIT_SIZE,
  zoom,
  pan,
}: {
  image: Size;
  frame?: Size;
  zoom: number;
  pan: Point;
}): PortraitCrop {
  if (!(image.width > 0 && image.height > 0 && frame.width > 0 && frame.height > 0)) {
    throw new RangeError('computePortraitCrop: sizes must be positive');
  }
  const z = clampZoom(zoom);
  const p = clampPan(image, frame, z, pan);
  const scale = coverScale(image, frame) * z;

  const width = image.width * scale;
  const height = image.height * scale;
  const display: Rect = {
    x: frame.width / 2 + p.x - width / 2,
    y: frame.height / 2 + p.y - height / 2,
    width,
    height,
  };

  const sw = Math.min(image.width, frame.width / scale);
  const sh = Math.min(image.height, frame.height / scale);
  // Clamp once more against floating-point drift at the edges.
  const sx = Math.min(image.width - sw, Math.max(0, -display.x / scale));
  const sy = Math.min(image.height - sh, Math.max(0, -display.y / scale));

  return { zoom: z, pan: p, scale, display, source: { x: sx, y: sy, width: sw, height: sh } };
}

/**
 * Change zoom while keeping the point under the frame's centre fixed (so the
 * face the organizer has centred stays centred), then clamp.
 */
export function zoomAroundCentre(
  image: Size,
  frame: Size,
  from: { zoom: number; pan: Point },
  toZoom: number,
): { zoom: number; pan: Point } {
  const z0 = clampZoom(from.zoom);
  const z1 = clampZoom(toZoom);
  const k = z1 / z0;
  return {
    zoom: z1,
    pan: clampPan(image, frame, z1, { x: from.pan.x * k, y: from.pan.y * k }),
  };
}
