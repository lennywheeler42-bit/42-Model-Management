// Comp card layouts and the drag-and-drop editor's design state. Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BACK_LAYOUTS, FRONT_LAYOUTS, FRONT_LOGO_WIDTH, LOGO_HEIGHT, MARGIN, PAGE, THEMES,
  changeLayout, clearSlot, defaultDesign, designSchema, dropPhoto, filledSlots, nameSize, swapSlots,
} from "../../src/features/compcard/layout.ts";

const ids = Array.from({ length: 8 }, (_, index) => `00000000-0000-4000-8000-00000000000${index}`);

test("every frame is on the page, and frames on one side never overlap", () => {
  for (const layout of [...FRONT_LAYOUTS, ...BACK_LAYOUTS]) {
    for (const slot of layout.slots) {
      assert.ok(slot.x >= 0 && slot.y >= 0 && slot.x + slot.width <= PAGE.width + 1e-9 && slot.y + slot.height <= PAGE.height, `${layout.key} ${slot.id}`);
    }
    for (const a of layout.slots) for (const b of layout.slots) {
      if (a === b) continue;
      const apart = a.x + a.width <= b.x + 1e-9 || b.x + b.width <= a.x + 1e-9 || a.y + a.height <= b.y + 1e-9 || b.y + b.height <= a.y + 1e-9;
      assert.ok(apart, `${layout.key}: ${a.id} overlaps ${b.id}`);
    }
    assert.equal(new Set(layout.slots.map((slot) => slot.id)).size, layout.slots.length);
  }
});

test("back photos leave room for the stats and the logo in the footer", () => {
  for (const layout of BACK_LAYOUTS) {
    const bottom = Math.max(...layout.slots.map((slot) => slot.y + slot.height));
    // Two rows of stats (about 50 pt) then the footer logo, 16 pt from the edge.
    assert.ok(bottom + 12 + 50 <= PAGE.height - 16 - LOGO_HEIGHT - 10, layout.key);
  }
  for (const layout of FRONT_LAYOUTS) {
    const bottom = Math.max(...layout.slots.map((slot) => slot.y + slot.height));
    assert.ok(PAGE.height - 14 - (bottom + 10) >= LOGO_HEIGHT + 10, `${layout.key}: no room for the logo`);
  }
});

test("the default design fills the frames with the first photos in order", () => {
  const design = defaultDesign(ids, true);
  assert.deepEqual(filledSlots(design).map(({ slot, placement }) => [slot.id, placement.photoId]), [["f0", ids[0]], ["b0", ids[1]], ["b1", ids[2]], ["b2", ids[3]], ["b3", ids[4]]]);
  assert.equal(defaultDesign(ids.slice(0, 2), false).measurements, false);
  assert.equal(filledSlots(defaultDesign([], true)).length, 0);
  assert.ok(designSchema.safeParse(design).success);
});

test("dropping, swapping and clearing frames", () => {
  let design = defaultDesign(ids.slice(0, 3), true);
  design = dropPhoto(design, "b3", ids[7]);
  assert.equal(design.slots.b3.photoId, ids[7]);
  assert.equal(design.slots.b3.zoom, 1);
  design = swapSlots(design, "f0", "b3");
  assert.equal(design.slots.f0.photoId, ids[7]);
  assert.equal(design.slots.b3.photoId, ids[0]);
  // Swapping onto an empty frame moves the photo.
  design = swapSlots(design, "b3", "b2");
  assert.equal(design.slots.b2.photoId, ids[0]);
  assert.equal(design.slots.b3, undefined);
  design = clearSlot(design, "b2");
  assert.equal(design.slots.b2, undefined);
});

test("changing layout keeps the side's photos in order and drops what does not fit", () => {
  let design = defaultDesign(ids, true);
  design = { ...design, slots: { ...design.slots, b1: { ...design.slots.b1, zoom: 2 } } };
  const six = changeLayout(design, "back", "grid6");
  assert.deepEqual(["b0", "b1", "b2", "b3", "b4", "b5"].map((id) => six.slots[id]?.photoId), [ids[1], ids[2], ids[3], ids[4], undefined, undefined]);
  assert.equal(six.slots.b1.zoom, 2, "a photo keeps its position");
  assert.equal(six.slots.f0.photoId, ids[0], "the front is untouched");
  const one = changeLayout(six, "back", "single");
  assert.deepEqual(Object.keys(one.slots).sort(), ["b0", "f0"]);
  assert.equal(changeLayout(design, "front", "nope").front, FRONT_LAYOUTS[0].key);
});

test("the design sent to the server is checked", () => {
  const design = defaultDesign(ids, true);
  assert.equal(designSchema.safeParse({ ...design, slots: { x9: design.slots.f0 } }).success, false);
  assert.equal(designSchema.safeParse({ ...design, slots: { f0: { ...design.slots.f0, zoom: 99 } } }).success, false);
  assert.equal(designSchema.safeParse({ ...design, slots: { f0: { ...design.slots.f0, photoId: "../etc" } } }).success, false);
});

test("a long name gets smaller so it stays on one line beside the logo", () => {
  const width = PAGE.width - MARGIN * 2 - FRONT_LOGO_WIDTH - 12;
  assert.equal(nameSize("Ava", width), 26);
  const long = "Alexandria Montgomery-Whitfield";
  assert.ok(nameSize(long, width) < 13);
  assert.ok(nameSize("WWWWWWWWWWWW", width) < nameSize("IIIIIIIIIIII", width), "wide letters take more room");
  assert.ok(nameSize("x".repeat(200), width) >= 10);
});

test("every theme has its own paper and ink", () => {
  assert.equal(new Set(THEMES.map((theme) => theme.key)).size, THEMES.length);
  for (const theme of THEMES) assert.notEqual(theme.paper, theme.ink);
});
