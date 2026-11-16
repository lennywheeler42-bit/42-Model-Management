import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/log";
import { readStored } from "@/features/media/library";
import { DEFAULT_TAGLINE } from "./layout";

// The logo and the line under it that every comp card prints (migration 043). The
// built-in 42 mark is used until staff with settings.manage upload another in the
// comp card editor. Everything runs as the signed-in user.

export const BRAND_BUCKET = "brand-assets";
export const LOGO_MAX_BYTES = 4 * 1024 * 1024;
const LOGO_EDGE = 1200;

export type CompCardBrand = { logoPath: string | null; tagline: string };

export async function compCardBrand(supabase: SupabaseClient): Promise<CompCardBrand> {
  // Before migration 043 there is no table: the built-in logo is used.
  const { data } = await supabase.from("comp_card_settings").select("logo_path,tagline").eq("id", true).maybeSingle();
  return { logoPath: (data?.logo_path as string | null) ?? null, tagline: typeof data?.tagline === "string" ? data.tagline : DEFAULT_TAGLINE };
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
