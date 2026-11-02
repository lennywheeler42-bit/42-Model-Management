// Pure geometry for the photo crop tool, shared by the editor and the server. No
// Next.js imports, so it is unit-tested directly (tests/unit/media-crop.test.mts).
//
// A crop is stored as fractions of the upright original, so it does not depend on the
// size the editor happened to be shown at, and the frame can be reopened later.

export type Crop = { x: number; y: number; width: number; height: number };
export type Frame = { aspect: number; zoom: number; centerX: number; centerY: number };

export const CROP_ASPECTS = [
  { key: "3:4", label: "Portrait 3:4", ratio: 3 / 4 },
  { key: "4:5", label: "Portrait 4:5", ratio: 4 / 5 },
  { key: "comp", label: "Comp card front", ratio: 360 / 520 },
  { key: "1:1", label: "Square", ratio: 1 },
  { key: "4:3", label: "Landscape 4:3", ratio: 4 / 3 },
  { key: "16:9", label: "Wide 16:9", ratio: 16 / 9 },
] as const;

export const MAX_ZOOM = 5;

// How large the image is relative to the frame at this zoom. Zoom 1 is the smallest
// size at which the image still covers the whole frame.
export function imageScale(imageAspect: number, frameAspect: number, zoom: number) {
  return imageAspect > frameAspect
    ? { width: zoom * (imageAspect / frameAspect), height: zoom }
    : { width: zoom, height: zoom * (frameAspect / imageAspect) };
}

// The part of the image inside the frame. The center is clamped so the frame never
// shows past the edge of the photo.
export function frameToCrop(imageAspect: number, frame: Frame): Crop {
  const scale = imageScale(imageAspect, frame.aspect, frame.zoom);
  const width = 1 / scale.width;
  const height = 1 / scale.height;
  const x = Math.min(1 - width, Math.max(0, frame.centerX - width / 2));
  const y = Math.min(1 - height, Math.max(0, frame.centerY - height / 2));
  return { x, y, width, height };
}

// A saved crop back into editor state.
export function cropToFrame(imageAspect: number, aspect: number, crop: Crop): Frame {
  const base = imageScale(imageAspect, aspect, 1);
  return {
    aspect,
    zoom: Math.min(MAX_ZOOM, Math.max(1, 1 / (crop.width * base.width))),
    centerX: crop.x + crop.width / 2,
    centerY: crop.y + crop.height / 2,
  };
}

// Whole pixels of an image this size, always inside it and at least 1 x 1.
export function cropPixels(crop: Crop, imageWidth: number, imageHeight: number) {
  const left = Math.min(imageWidth - 1, Math.max(0, Math.round(crop.x * imageWidth)));
  const top = Math.min(imageHeight - 1, Math.max(0, Math.round(crop.y * imageHeight)));
  return {
    left, top,
    width: Math.max(1, Math.min(imageWidth - left, Math.round(crop.width * imageWidth))),
    height: Math.max(1, Math.min(imageHeight - top, Math.round(crop.height * imageHeight))),
  };
}

// EXIF orientations 5-8 store the picture on its side.
export function uprightSize(width: number, height: number, orientation?: number) {
  return (orientation ?? 1) >= 5 ? { width: height, height: width } : { width, height };
}
