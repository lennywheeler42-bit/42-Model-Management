// Photo crop geometry. Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasOutdatedWebCopy, isWebCopyPath, staleCopies } from "../../src/features/media/copies.ts";
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

test("old copies go; the current copy and the original stay", () => {
  assert.deepEqual(staleCopies(["a-1.jpg", "a-2.jpg", "a-3.jpg"], "a-3.jpg", null), ["a-1.jpg", "a-2.jpg"]);
  // Withdrawn: nothing is kept, so nothing can stay reachable by its public link.
  assert.deepEqual(staleCopies(["a-1.jpg", "a-2.jpg"], null, null), ["a-1.jpg", "a-2.jpg"]);
  // An original that lives in the public bucket is never a copy.
  assert.deepEqual(staleCopies(["a-1.jpg", "original.jpg"], null, "original.jpg"), ["a-1.jpg"]);
  // A file found twice (listed, and named on the row) is removed once.
  assert.deepEqual(staleCopies(["a-1.jpg", "a-1.jpg"], null, null), ["a-1.jpg"]);
  assert.deepEqual(staleCopies([], null, null), []);
});

test("sideways EXIF orientations swap width and height", () => {
  assert.deepEqual(uprightSize(4000, 3000, 6), { width: 3000, height: 4000 });
  assert.deepEqual(uprightSize(4000, 3000, 1), { width: 4000, height: 3000 });
  assert.deepEqual(uprightSize(4000, 3000), { width: 4000, height: 3000 });
});

test("a website copy made from the stored photo is told from the first import's small file", () => {
  const id = "f0725627-30e9-47b3-bf65-7621087bc61d";
  assert.equal(isWebCopyPath(id, `talent/t-1/${id}-1794324508412.jpg`), true);
  // The first CDS import: WebForFashion's resized file, named after its media id.
  assert.equal(isWebCopyPath(id, `talent/t-1/${id}-cds-6750110.jpg`), false);
  assert.equal(isWebCopyPath(id, `talent/t-1/${id}-photo.jpg`), false);
  // Another photo's copy is not this photo's.
  assert.equal(isWebCopyPath(id, "talent/t-1/aaaaaaaa-30e9-47b3-bf65-7621087bc61d-1794324508412.jpg"), false);
  assert.equal(isWebCopyPath(id, null), false);
});

test("only photos on the website, from the library, with an old copy are remade", () => {
  const id = "f0725627-30e9-47b3-bf65-7621087bc61d";
  const photo = { id, public: true, storage_bucket: "model-photos", public_storage_path: `talent/t-1/${id}-cds-6750110.jpg` };
  assert.equal(hasOutdatedWebCopy(photo, "model-photos"), true);
  // Already remade: running the update again changes nothing.
  assert.equal(hasOutdatedWebCopy({ ...photo, public_storage_path: `talent/t-1/${id}-1794324508412.jpg` }, "model-photos"), false);
  // Private photos stay private: the update never puts a photo on the website.
  assert.equal(hasOutdatedWebCopy({ ...photo, public: false }, "model-photos"), false);
  assert.equal(hasOutdatedWebCopy({ ...photo, public_storage_path: null }, "model-photos"), false);
  // Outside the library the website copy is the stored file itself.
  assert.equal(hasOutdatedWebCopy({ ...photo, storage_bucket: "talent-private" }, "model-photos"), false);
});
