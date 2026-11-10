import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createElement } from "react";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { feetInches, lengthLabel, shoeLabel } from "@/lib/format";
import { siteOrigin } from "@/lib/site";
import { getSiteSettings } from "@/features/cms/queries";
import { readStored } from "@/features/media/library";
import { cropPixels, frameToCrop } from "@/features/media/crop";
import { LIBRARY_BUCKET, type StoredPhoto } from "@/features/media/urls";
import { CompCardDocument, type CompCardData } from "./CompCardDocument";
import { BACK_LAYOUTS, FRONT_LAYOUTS, defaultDesign, filledSlots, findLayout, findTheme, type Design } from "./layout";

// Builds a comp card from the talent's whole gallery, with no second upload: staff
// drag any photo into a frame, cropped versions are used as framed, and photos a
// talent sent that are still in review or were rejected are left out. Runs as the
// signed-in staff member, so RLS decides what can be read. Measurements print only if
// the talent allows them to be public. Private contact and legal details are never read.

export type CompCardPhoto = StoredPhoto & { cropped_path: string | null; alt_text: string | null; featured: boolean; public: boolean };

export async function galleryPhotos(supabase: SupabaseClient, talentId: string) {
  const { data, error } = await supabase.from("talent_photos").select("id,storage_bucket,storage_path,public_storage_path,thumbnail_path,cropped_path,alt_text,featured,public,review_status")
    .eq("talent_id", talentId).is("archived_at", null)
    .order("featured", { ascending: false }).order("public", { ascending: false }).order("display_order").limit(5000);
  if (error) throw error;
  return (data ?? []).filter((photo) => (photo.review_status ?? "approved") === "approved") as (CompCardPhoto & { review_status: string | null })[];
}

export async function publicStats(supabase: SupabaseClient, talentId: string, gender: string | null) {
  const { data } = await supabase.from("talent_measurements").select("height_cm,bust_chest_cm,waist_cm,hips_cm,shoe_size_us,suit_size,hair_color,eye_color")
    .eq("talent_id", talentId).order("is_official", { ascending: false }).order("measured_on", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return [];
  return ([
    ["Height", data.height_cm ? feetInches(data.height_cm) : null],
    [gender?.toLowerCase() === "male" ? "Chest" : "Bust", lengthLabel(data.bust_chest_cm)],
    ["Waist", lengthLabel(data.waist_cm)], ["Hips", lengthLabel(data.hips_cm)],
    ["Shoe", shoeLabel(data.shoe_size_us)], ["Suit", data.suit_size],
    ["Hair", data.hair_color], ["Eyes", data.eye_color],
  ] as [string, string | null][]).filter(([, value]) => value).map(([label, value]) => ({ label, value: value as string }));
}

// The photo as staff framed it in the media tab (crop, else website copy, else
// original), upright. The editor's thumbnails are made from the same image, so a
// frame's zoom and center mean the same here as on screen.
async function source(supabase: SupabaseClient, photo: CompCardPhoto) {
  const bytes = photo.cropped_path ? await readStored(supabase, LIBRARY_BUCKET, photo.cropped_path)
    : photo.public_storage_path ? await readStored(supabase, "talent-public", photo.public_storage_path)
    : await readStored(supabase, photo.storage_bucket, photo.storage_path);
  const meta = await sharp(bytes).metadata();
  // EXIF orientations 5–8 turn the photo on its side.
  const turned = (meta.orientation ?? 1) >= 5;
  return { data: bytes, width: (turned ? meta.height : meta.width) ?? 1, height: (turned ? meta.width : meta.height) ?? 1 };
}

// Print resolution: about 300 dpi, capped so a full-bleed front stays a sensible size.
const PIXELS_PER_POINT = 300 / 72;
const MAX_EDGE = 2200;

// react-pdf does not read WebP, so the logo is turned into PNG. Traced into the route
// by next.config.ts; a card without it falls back to a text mark.
async function logo() {
  try {
    const { data, info } = await sharp(await readFile(join(process.cwd(), "public/brand/logo-mark-480.webp"))).png().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

export async function renderCompCard(supabase: SupabaseClient, talentId: string, requested: Design | null) {
  const { data: talent, error } = await supabase.from("talent").select("id,display_name,location,gender,show_measurements").eq("id", talentId).maybeSingle();
  if (error) throw error;
  if (!talent) return null;
  const photos = await galleryPhotos(supabase, talentId);
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  // Frames may only hold this talent's own gallery photos; anything else is dropped.
  const design = requested ?? defaultDesign(photos.map((photo) => photo.id), true);
  const filled = filledSlots(design).filter(({ placement }) => byId.has(placement.photoId));
  if (!filled.length) return { error: "Drag at least one photo onto the card first." } as const;

  const sources = new Map<string, ReturnType<typeof source>>();
  const images: Record<string, Buffer> = {};
  await Promise.all(filled.map(async ({ slot, placement }) => {
    if (!sources.has(placement.photoId)) sources.set(placement.photoId, source(supabase, byId.get(placement.photoId)!));
    const image = await sources.get(placement.photoId)!;
    const crop = frameToCrop(image.width / image.height, { aspect: slot.width / slot.height, zoom: placement.zoom, centerX: placement.centerX, centerY: placement.centerY });
    const width = Math.min(MAX_EDGE, Math.round(slot.width * PIXELS_PER_POINT));
    // rotate() before extract(): the frame is cut from the upright photo.
    images[slot.id] = await sharp(image.data).rotate().extract(cropPixels(crop, image.width, image.height))
      .resize({ width, height: Math.round((width * slot.height) / slot.width), fit: "cover", withoutEnlargement: true })
      .jpeg({ quality: 88 }).toBuffer();
  }));

  const theme = findTheme(design.theme);
  const settings = await getSiteSettings();
  const card: CompCardData = {
    name: talent.display_name,
    location: talent.location,
    theme,
    front: findLayout(FRONT_LAYOUTS, design.front),
    back: findLayout(BACK_LAYOUTS, design.back),
    images,
    stats: design.measurements && talent.show_measurements ? await publicStats(supabase, talentId, talent.gender) : [],
    contact: { email: settings.contact_email, phone: settings.contact_phone, website: siteOrigin()?.replace(/^https?:\/\//, "") ?? null, locationLine: settings.location_line },
    logo: await logo(),
  };
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const pdf = await renderToBuffer(createElement(CompCardDocument, { card }) as Parameters<typeof renderToBuffer>[0]);
  return { pdf, name: talent.display_name, photos: filled.length } as const;
}
