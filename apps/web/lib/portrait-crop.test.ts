import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ZOOM,
  PORTRAIT_ASPECT,
  PORTRAIT_SIZE,
  clampPan,
  computePortraitCrop,
  zoomAroundCentre,
  type Rect,
} from './portrait-crop.ts';

const frame = PORTRAIT_SIZE; // 700 x 900

function near(actual: number, expected: number, msg?: string) {
  assert.ok(
    Math.abs(actual - expected) < 1e-6,
    `${msg ?? ''} expected ${expected}, got ${actual}`,
  );
}

function assertRect(actual: Rect, expected: Rect) {
  near(actual.x, expected.x, 'x');
  near(actual.y, expected.y, 'y');
  near(actual.width, expected.width, 'width');
  near(actual.height, expected.height, 'height');
}

test('the frame is 7:9', () => {
  near(frame.width / frame.height, PORTRAIT_ASPECT);
});

test('landscape image: fills the height, centred, pans only sideways', () => {
  const image = { width: 1600, height: 900 };
  const crop = computePortraitCrop({ image, frame, zoom: 1, pan: { x: 0, y: 0 } });
  near(crop.scale, 1);
  assertRect(crop.source, { x: 450, y: 0, width: 700, height: 900 });
  assertRect(crop.display, { x: -450, y: 0, width: 1600, height: 900 });

  // Moving the photo right reveals its left side, up to the very edge.
  const left = computePortraitCrop({ image, frame, zoom: 1, pan: { x: 450, y: 0 } });
  near(left.source.x, 0);
  // No vertical slack at zoom 1: a vertical drag is clamped to nothing.
  const vertical = computePortraitCrop({ image, frame, zoom: 1, pan: { x: 0, y: 200 } });
  assert.deepEqual(vertical.pan, { x: 0, y: 0 });
});

test('portrait image: fills the width, centred, pans only up and down', () => {
  const image = { width: 900, height: 1800 };
  const crop = computePortraitCrop({ image, frame, zoom: 1, pan: { x: 0, y: 0 } });
  near(crop.scale, 700 / 900);
  assertRect(crop.source, {
    x: 0,
    y: (1800 - 900 / (700 / 900)) / 2,
    width: 900,
    height: 900 / (700 / 900),
  });
  // The top of the photo (usually where the face is) is reachable.
  const top = computePortraitCrop({ image, frame, zoom: 1, pan: { x: 0, y: 9999 } });
  near(top.source.y, 0);
  near(top.pan.y, (1800 * (700 / 900) - 900) / 2);
});

test('square image: fills the height, a little sideways slack', () => {
  const image = { width: 1000, height: 1000 };
  const crop = computePortraitCrop({ image, frame, zoom: 1, pan: { x: 0, y: 0 } });
  near(crop.scale, 0.9);
  assertRect(crop.source, {
    x: (1000 - 700 / 0.9) / 2,
    y: 0,
    width: 700 / 0.9,
    height: 1000,
  });
  assert.deepEqual(clampPan(image, frame, 1, { x: 500, y: 500 }), { x: 100, y: 0 });
});

test('max zoom: 3x closer, centred, and zoom beyond the maximum is clamped', () => {
  const image = { width: 1000, height: 1000 };
  const crop = computePortraitCrop({ image, frame, zoom: MAX_ZOOM, pan: { x: 0, y: 0 } });
  near(crop.zoom, 3);
  near(crop.scale, 2.7);
  assertRect(crop.source, {
    x: (1000 - 700 / 2.7) / 2,
    y: (1000 - 900 / 2.7) / 2,
    width: 700 / 2.7,
    height: 900 / 2.7,
  });
  const over = computePortraitCrop({ image, frame, zoom: 10, pan: { x: 0, y: 0 } });
  near(over.zoom, MAX_ZOOM);
  const under = computePortraitCrop({ image, frame, zoom: 0.2, pan: { x: 0, y: 0 } });
  near(under.zoom, 1);
});

test('pan beyond the edge is clamped so no empty edge can show', () => {
  const image = { width: 1600, height: 900 };
  for (const zoom of [1, 1.5, 2, 3]) {
    for (const pan of [
      { x: 1e6, y: 1e6 },
      { x: -1e6, y: -1e6 },
      { x: 1e6, y: -1e6 },
      { x: Number.NaN, y: Number.POSITIVE_INFINITY },
    ]) {
      const crop = computePortraitCrop({ image, frame, zoom, pan });
      // The drawn image still covers the entire frame.
      assert.ok(crop.display.x <= 1e-9, `left edge shows at zoom ${zoom}`);
      assert.ok(crop.display.y <= 1e-9, `top edge shows at zoom ${zoom}`);
      assert.ok(crop.display.x + crop.display.width >= frame.width - 1e-9);
      assert.ok(crop.display.y + crop.display.height >= frame.height - 1e-9);
      // And the source rectangle stays inside the image.
      assert.ok(crop.source.x >= 0 && crop.source.y >= 0);
      assert.ok(crop.source.x + crop.source.width <= image.width + 1e-9);
      assert.ok(crop.source.y + crop.source.height <= image.height + 1e-9);
    }
  }
  const pinned = computePortraitCrop({ image, frame, zoom: 2, pan: { x: -1e6, y: 1e6 } });
  // Dragged fully left and down: the photo's right edge meets the frame's
  // right edge, and its top edge meets the frame's top edge.
  near(pinned.source.x + pinned.source.width, image.width);
  near(pinned.source.y, 0);
});

test('the source rectangle always keeps the 7:9 ratio', () => {
  for (const image of [
    { width: 4032, height: 3024 },
    { width: 3024, height: 4032 },
    { width: 700, height: 900 },
    { width: 120, height: 80 },
  ]) {
    for (const zoom of [1, 1.7, 3]) {
      const { source } = computePortraitCrop({ image, frame, zoom, pan: { x: 37, y: -52 } });
      near(source.width / source.height, PORTRAIT_ASPECT);
    }
  }
});

test('zooming keeps the centred point centred, then clamps', () => {
  const image = { width: 1000, height: 1000 };
  const next = zoomAroundCentre(image, frame, { zoom: 1, pan: { x: 100, y: 0 } }, 2);
  assert.deepEqual(next, { zoom: 2, pan: { x: 200, y: 0 } });
  // Zooming back out pulls an off-limits pan back inside the frame.
  const back = zoomAroundCentre(image, frame, { zoom: 3, pan: { x: 1000, y: 900 } }, 1);
  assert.deepEqual(back, { zoom: 1, pan: { x: 100, y: 0 } });
});

test('rejects empty sizes instead of producing NaN', () => {
  assert.throws(() =>
    computePortraitCrop({ image: { width: 0, height: 10 }, frame, zoom: 1, pan: { x: 0, y: 0 } }),
  );
});
