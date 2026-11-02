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
import { LIBRARY_BUCKET, type StoredPhoto } from "@/features/media/urls";
import { CompCardDocument, type CompCardData } from "./CompCardDocument";

// Builds a comp card from the talent's whole gallery, with no second upload: staff
// choose any photo, cropped versions are used as framed, and photos a talent sent
// that are still in review or were rejected are left out. Runs as the signed-in staff
// member, so RLS decides what can be read. Measurements print only if the talent
// allows them to be public. Private contact and legal details are never read.

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

// Reads the photo as staff framed it (crop, else website copy, else original) and
// re-encodes it as JPEG (react-pdf does not read WebP).
async function jpeg(supabase: SupabaseClient, photo: CompCardPhoto, width: number) {
  const bytes = photo.cropped_path ? await readStored(supabase, LIBRARY_BUCKET, photo.cropped_path)
    : photo.public_storage_path ? await readStored(supabase, "talent-public", photo.public_storage_path)
    : await readStored(supabase, photo.storage_bucket, photo.storage_path);
  return sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
}

export async function renderCompCard(supabase: SupabaseClient, talentId: string, options: { photoIds: string[]; measurements: boolean }) {
  const { data: talent, error } = await supabase.from("talent").select("id,display_name,location,gender,show_measurements").eq("id", talentId).maybeSingle();
  if (error) throw error;
  if (!talent) return null;
  const photos = await galleryPhotos(supabase, talentId);
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const chosen = options.photoIds.map((id) => byId.get(id)).filter(Boolean) as CompCardPhoto[];
  const selection = chosen.length ? chosen : photos.slice(0, 5);
  if (!selection.length) return { error: "This talent has no photos yet. Add at least one in the Media tab first." } as const;

  const [primary, ...supporting] = await Promise.all(selection.slice(0, 5).map((photo, index) => jpeg(supabase, photo, index === 0 ? 1400 : 800)));
  const settings = await getSiteSettings();
  const card: CompCardData = {
    name: talent.display_name,
    location: talent.location,
    primary,
    supporting: supporting.length ? supporting : [primary],
    stats: options.measurements && talent.show_measurements ? await publicStats(supabase, talentId, talent.gender) : [],
    contact: { email: settings.contact_email, phone: settings.contact_phone, website: siteOrigin()?.replace(/^https?:\/\//, "") ?? null, locationLine: settings.location_line },
    // Traced into the route by next.config.ts. A card without it falls back to a text mark.
    logo: await readFile(join(process.cwd(), "public/brand/logo-mark.png")).catch(() => null),
  };
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const pdf = await renderToBuffer(createElement(CompCardDocument, { card }) as Parameters<typeof renderToBuffer>[0]);
  return { pdf, name: talent.display_name } as const;
}
