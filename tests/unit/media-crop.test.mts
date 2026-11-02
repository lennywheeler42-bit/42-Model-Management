// Photo crop geometry. Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { cropPixels, cropToFrame, frameToCrop, imageScale, uprightSize, MAX_ZOOM } from "../../src/features/media/crop.ts";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test("at zoom 1 the photo exactly covers the frame", () => {
  assert.deepEqual(imageScale(1, 1, 1), { width: 1, height: 1 });
  // A wide photo in a portrait frame overflows sideways only.
  const wide = imageScale(3 / 2, 3 / 4, 1);
  near(wide.width, 2);
  near(wide.height, 1);
  // A tall photo in a wide frame overflows up and down only.
  const tall = imageScale(2 / 3, 4 / 3, 1);
  near(tall.width, 1);
  near(tall.height, 2);
});

test("the crop has the frame's shape", () => {
  const imageAspect = 3 / 2;
  for (const aspect of [3 / 4, 1, 16 / 9]) {
    for (const zoom of [1, 2.5, MAX_ZOOM]) {
      const crop = frameToCrop(imageAspect, { aspect, zoom, centerX: 0.5, centerY: 0.5 });
      near((crop.width * imageAspect) / crop.height, aspect);
    }
  }
});

test("dragging past the edge stops at the edge of the photo", () => {
  const frame = { aspect: 3 / 4, zoom: 2, centerX: -5, centerY: 9 };
  const crop = frameToCrop(3 / 2, frame);
  near(crop.x, 0);
  near(crop.y + crop.height, 1);
  assert.ok(crop.width <= 1 && crop.height <= 1);
});

test("a saved crop reopens where it was left", () => {
  const imageAspect = 2 / 3;
  const frame = { aspect: 1, zoom: 1.75, centerX: 0.4, centerY: 0.35 };
  const reopened = cropToFrame(imageAspect, 1, frameToCrop(imageAspect, frame));
  near(reopened.zoom, frame.zoom);
  near(reopened.centerX, frame.centerX);
  near(reopened.centerY, frame.centerY);
});

test("pixels stay inside the image, even with rounding", () => {
  assert.deepEqual(cropPixels({ x: 0.25, y: 0.5, width: 0.5, height: 0.5 }, 1000, 2000), { left: 250, top: 1000, width: 500, height: 1000 });
  const edge = cropPixels({ x: 0.999, y: 0.999, width: 0.5, height: 0.5 }, 1000, 1000);
  assert.ok(edge.left + edge.width <= 1000 && edge.top + edge.height <= 1000);
  assert.ok(edge.width >= 1 && edge.height >= 1);
});

test("sideways EXIF orientations swap width and height", () => {
  assert.deepEqual(uprightSize(4000, 3000, 6), { width: 3000, height: 4000 });
  assert.deepEqual(uprightSize(4000, 3000, 1), { width: 4000, height: 3000 });
  assert.deepEqual(uprightSize(4000, 3000), { width: 4000, height: 3000 });
});
