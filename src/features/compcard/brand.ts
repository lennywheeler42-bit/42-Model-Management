import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/log";
import { readStored } from "@/features/media/library";
import { DEFAULT_TAGLINE } from "./layout";

// What every comp card prints unless a card types over it (migrations 043, 046): the
// logo and the line under it, the line under the talent's name, and the contact lines
// on the back. Edited in the comp card editor by staff with settings.manage. Before
// those are saved, the built-in 42 logo and the fallbacks below are used. Everything
// runs as the signed-in user.

export const BRAND_BUCKET = "brand-assets";
export const LOGO_MAX_BYTES = 4 * 1024 * 1024;
const LOGO_EDGE = 1200;

// The owner's defaults (2026-11-17), also seeded by migration 046.
export const DEFAULT_SUBTITLE = "42modelmanagement.com";
export const DEFAULT_CONTACT = ["lenny@42modelmanagement.com", "214-463-9970"];

export type CompCardBrand = { logoPath: string | null; tagline: string; subtitle: string; contact: string[] };

export async function compCardBrand(supabase: SupabaseClient): Promise<CompCardBrand> {
  // Before migration 046 the newer columns are missing: fall back to the older select.
  const full = await supabase.from("comp_card_settings").select("logo_path,tagline,subtitle,contact_lines").eq("id", true).maybeSingle();
  const data = full.error ? (await supabase.from("comp_card_settings").select("logo_path,tagline").eq("id", true).maybeSingle()).data : full.data;
  const row = (data ?? {}) as { logo_path?: string | null; tagline?: string | null; subtitle?: string | null; contact_lines?: string[] | null };
  return {
    logoPath: row.logo_path ?? null,
    tagline: typeof row.tagline === "string" ? row.tagline : DEFAULT_TAGLINE,
    subtitle: typeof row.subtitle === "string" ? row.subtitle : DEFAULT_SUBTITLE,
    contact: Array.isArray(row.contact_lines) ? row.contact_lines : DEFAULT_CONTACT,
  };
}

export const brandLogoUrl = (supabase: SupabaseClient, path: string | null) => (path ? supabase.storage.from(BRAND_BUCKET).getPublicUrl(path).data.publicUrl : null);

// Any JPEG, PNG or WebP becomes a PNG of a sensible size: the PDF reads PNG, and
// re-encoding means only a real image is ever stored. Throws if it is not an image.
export async function normaliseLogo(bytes: Buffer) {
  const image = sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 });
  const info = await image.metadata();
  if (!["jpeg", "png", "webp"].includes(info.format ?? "") || !info.width || !info.height) throw new Error("not a supported image");
  return image.rotate().resize({ width: LOGO_EDGE, height: LOGO_EDGE, fit: "inside", withoutEnlargement: true }).png().toBuffer();
}

// react-pdf does not read WebP, so the built-in logo is turned into PNG. Traced into
// the route by next.config.ts.
async function builtInLogo() {
  const { data, info } = await sharp(await readFile(join(process.cwd(), "public/brand/logo-mark-480.webp"))).png().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// The logo to print: the uploaded one, else the 42 mark, else null (a text mark).
export async function printLogo(supabase: SupabaseClient, brand: CompCardBrand) {
  if (brand.logoPath) {
    try {
      const { data, info } = await sharp(await readStored(supabase, BRAND_BUCKET, brand.logoPath)).png().toBuffer({ resolveWithObject: true });
      return { data, width: info.width, height: info.height };
    } catch (error) {
      log.warn("compcard", "uploaded logo could not be read; using the 42 logo", { error: (error as { message?: string })?.message ?? "unknown" });
    }
  }
  try {
    return await builtInLogo();
  } catch {
    return null;
  }
}
