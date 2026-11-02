import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cropPixels, uprightSize, type Crop } from "./crop";
import { LIBRARY_BUCKET } from "./urls";

// The model-photos library (migration 036): <talent id>/originals|thumbnails|cropped.
// Everything runs as the caller, so RLS and storage policies apply.

const THUMBNAIL_EDGE = 800;
const WEB_EDGE = 2400;
const MAX_INPUT_PIXELS = 120_000_000;

const FORMATS: Record<string, { extension: string; mime: string }> = {
  jpeg: { extension: "jpg", mime: "image/jpeg" },
  png: { extension: "png", mime: "image/png" },
  webp: { extension: "webp", mime: "image/webp" },
};

export const libraryPath = (talentId: string, folder: "originals" | "thumbnails" | "cropped", file: string) => `${talentId}/${folder}/${file}`;

// Reads the file itself, not its name or claimed type. Throws if it is not a whole,
// readable JPEG, PNG or WebP.
export async function inspectImage(bytes: Buffer) {
  const image = sharp(bytes, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS });
  const info = await image.metadata();
  const format = FORMATS[info.format ?? ""];
  if (!format || !info.width || !info.height) throw new Error(`not a supported image (${info.format ?? "unknown"})`);
  await image.clone().resize({ width: 8, height: 8, fit: "inside" }).toBuffer();
  return {
    ...format,
    ...uprightSize(info.width, info.height, info.orientation),
    fileSize: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export const makeThumbnail = (bytes: Buffer) => sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).rotate()
  .resize({ width: THUMBNAIL_EDGE, height: THUMBNAIL_EDGE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();

// What the website serves: never the full original.
export const makeWebCopy = (bytes: Buffer) => sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).rotate()
  .resize({ width: WEB_EDGE, height: WEB_EDGE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();

export async function makeCrop(bytes: Buffer, crop: Crop) {
  const info = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  const { width, height } = uprightSize(info.width ?? 1, info.height ?? 1, info.orientation);
  // Rotate first, as a separate pass: the crop is measured on the upright picture.
  const upright = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).rotate().toBuffer();
  return sharp(upright, { limitInputPixels: MAX_INPUT_PIXELS }).extract(cropPixels(crop, width, height)).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

export async function readStored(supabase: SupabaseClient, bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw error ?? new Error("file not found");
  return Buffer.from(await data.arrayBuffer());
}

export async function storeThumbnail(supabase: SupabaseClient, path: string, source: Buffer) {
  const { error } = await supabase.storage.from(LIBRARY_BUCKET).upload(path, await makeThumbnail(source), { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return path;
}
