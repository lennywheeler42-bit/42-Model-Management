// Comp card layouts and themes, shared by the drag-and-drop editor and the PDF so the
// preview and the printed card match. Pure: no Next.js imports, so it is unit-tested
// directly (tests/unit/compcard-layout.test.mts).
//
// Everything is in PDF points on a 5.5 × 8.5 in page (396 × 612). Each photo frame
// keeps its own position inside the frame (zoom and center, as in the crop tool), so
// a photo dragged into a frame can then be moved and zoomed in place.

import { z } from "zod";
import { MAX_ZOOM } from "../media/crop.ts";

export const PAGE = { width: 396, height: 612 } as const;
export const MARGIN = 18;
const GAP = 6;
const INNER = PAGE.width - MARGIN * 2; // 360

export type Slot = { id: string; x: number; y: number; width: number; height: number };
export type Layout = { key: string; label: string; slots: Slot[] };

const half = (INNER - GAP) / 2; // 177
const third = (INNER - GAP * 2) / 3; // 116
// Back photos stop above the stats and the logo in the footer.
const BACK_HEIGHT = 450;
const row = (BACK_HEIGHT - GAP) / 2; // 222

export const FRONT_LAYOUTS: Layout[] = [
  { key: "single", label: "One photo", slots: [{ id: "f0", x: MARGIN, y: MARGIN, width: INNER, height: 492 }] },
  { key: "bleed", label: "Full bleed", slots: [{ id: "f0", x: 0, y: 0, width: PAGE.width, height: 520 }] },
  { key: "duo", label: "Two photos", slots: [
    { id: "f0", x: MARGIN, y: MARGIN, width: half, height: 492 },
    { id: "f1", x: MARGIN + half + GAP, y: MARGIN, width: half, height: 492 },
  ] },
];

export const BACK_LAYOUTS: Layout[] = [
  { key: "grid4", label: "Four photos", slots: [
    { id: "b0", x: MARGIN, y: MARGIN, width: half, height: row },
    { id: "b1", x: MARGIN + half + GAP, y: MARGIN, width: half, height: row },
    { id: "b2", x: MARGIN, y: MARGIN + row + GAP, width: half, height: row },
    { id: "b3", x: MARGIN + half + GAP, y: MARGIN + row + GAP, width: half, height: row },
  ] },
  { key: "feature3", label: "One large, two small", slots: [
    { id: "b0", x: MARGIN, y: MARGIN, width: half, height: BACK_HEIGHT },
    { id: "b1", x: MARGIN + half + GAP, y: MARGIN, width: half, height: row },
    { id: "b2", x: MARGIN + half + GAP, y: MARGIN + row + GAP, width: half, height: row },
  ] },
  { key: "grid6", label: "Six photos", slots: [0, 1].flatMap((r) => [0, 1, 2].map((c) => (
    { id: `b${r * 3 + c}`, x: MARGIN + c * (third + GAP), y: MARGIN + r * (row + GAP), width: third, height: row }
  ))) },
  { key: "duo", label: "Two photos", slots: [
    { id: "b0", x: MARGIN, y: MARGIN, width: half, height: BACK_HEIGHT },
    { id: "b1", x: MARGIN + half + GAP, y: MARGIN, width: half, height: BACK_HEIGHT },
  ] },
  { key: "single", label: "One photo", slots: [{ id: "b0", x: MARGIN, y: MARGIN, width: INNER, height: BACK_HEIGHT }] },
];

// Every theme prints the 42 / FORTY TWO mark with "Model Management" set in the
// theme's ink under it: the full logo's own last line is too small to read on a card.
export type Theme = { key: string; label: string; paper: string; ink: string; muted: string; rule: string };
export const THEMES: Theme[] = [
  { key: "white", label: "White", paper: "#ffffff", ink: "#181817", muted: "#7a7770", rule: "#dcdcd6" },
  { key: "ivory", label: "Ivory", paper: "#f5f0e6", ink: "#1f1c17", muted: "#7d7466", rule: "#d9cfbd" },
  { key: "black", label: "Black", paper: "#111111", ink: "#f4f1ea", muted: "#a8a399", rule: "#3a3835" },
];

// Logo art height on the card, and the room the logo takes beside the name on the front.
export const LOGO_HEIGHT = 32;
export const FRONT_LOGO_WIDTH = 106;

export const findLayout = (list: Layout[], key: string) => list.find((layout) => layout.key === key) ?? list[0];
export const findTheme = (key: string) => THEMES.find((theme) => theme.key === key) ?? THEMES[0];

export type Placement = { photoId: string; zoom: number; centerX: number; centerY: number };
export type Design = { front: string; back: string; theme: string; measurements: boolean; slots: Record<string, Placement> };

const id = z.string().regex(/^[0-9a-f-]{36}$/i);
export const placementSchema = z.object({
  photoId: id,
  zoom: z.number().min(1).max(MAX_ZOOM),
  centerX: z.number().min(0).max(1),
  centerY: z.number().min(0).max(1),
});
export const designSchema = z.object({
  front: z.string().max(20),
  back: z.string().max(20),
  theme: z.string().max(20),
  measurements: z.boolean(),
  slots: z.record(z.string().regex(/^[fb]\d$/), placementSchema),
});

export const placed = (photoId: string): Placement => ({ photoId, zoom: 1, centerX: 0.5, centerY: 0.5 });

// The first photos of the gallery, in order, in the default layouts.
export function defaultDesign(photoIds: string[], measurements: boolean): Design {
  const front = FRONT_LAYOUTS[0];
  const back = BACK_LAYOUTS[0];
  const slots: Record<string, Placement> = {};
  [...front.slots, ...back.slots].forEach((slot, index) => { if (photoIds[index]) slots[slot.id] = placed(photoIds[index]); });
  return { front: front.key, back: back.key, theme: THEMES[0].key, measurements, slots };
}

// Switching layout keeps the photos already placed on that side, in order, and drops
// what no longer fits. Photos keep their position when the frame keeps its id.
export function changeLayout(design: Design, side: "front" | "back", key: string): Design {
  const list = side === "front" ? FRONT_LAYOUTS : BACK_LAYOUTS;
  const prefix = side === "front" ? "f" : "b";
  const before = findLayout(list, design[side]).slots.map((slot) => design.slots[slot.id]).filter(Boolean);
  const after = findLayout(list, key);
  const slots = Object.fromEntries(Object.entries(design.slots).filter(([slotId]) => !slotId.startsWith(prefix)));
  after.slots.forEach((slot, index) => { if (before[index]) slots[slot.id] = before[index]; });
  return { ...design, [side]: after.key, slots };
}

// Drop a gallery photo on a frame (replacing what was there), or drag one frame onto
// another to swap them.
export function dropPhoto(design: Design, slotId: string, photoId: string): Design {
  return { ...design, slots: { ...design.slots, [slotId]: placed(photoId) } };
}
export function swapSlots(design: Design, from: string, to: string): Design {
  if (from === to) return design;
  const slots = { ...design.slots };
  const a = slots[from];
  const b = slots[to];
  if (b) slots[from] = b; else delete slots[from];
  if (a) slots[to] = a; else delete slots[to];
  return { ...design, slots };
}
export function clearSlot(design: Design, slotId: string): Design {
  const slots = { ...design.slots };
  delete slots[slotId];
  return { ...design, slots };
}

// The frames of a design that hold a photo, front first, in layout order.
export function filledSlots(design: Design) {
  const slots = [...findLayout(FRONT_LAYOUTS, design.front).slots, ...findLayout(BACK_LAYOUTS, design.back).slots];
  return slots.flatMap((slot) => design.slots[slot.id] ? [{ slot, placement: design.slots[slot.id] }] : []);
}

// Helvetica-Bold advance widths (1/1000 em) for what a name in capitals can hold.
const CAPS: Record<string, number> = {
  A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 556, K: 722, L: 611, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  " ": 278, "-": 333, "'": 278, "’": 278, ".": 278, ",": 278, "&": 722,
};
export const NAME_TRACKING = -0.5;

// The size of the name on the front (bold capitals, NAME_TRACKING apart), so that it
// stays on one line in the room left beside the logo; 26 pt at most, 10 at least.
export function nameSize(name: string, width: number) {
  const text = name.trim().toUpperCase() || " ";
  const em = [...text].reduce((sum, char) => sum + (CAPS[char] ?? (/[0-9]/.test(char) ? 556 : 778)), 0) / 1000;
  // react-pdf breaks lines on the untracked width, so the tracking is not counted.
  const fit = (width * 0.96) / em;
  return Math.floor(Math.min(26, Math.max(10, fit)) * 10) / 10;
}
