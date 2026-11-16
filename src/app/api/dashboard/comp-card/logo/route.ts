import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseError, writeAudit } from "@/lib/api";
import { requireApi } from "@/lib/agency-auth";
import { log } from "@/lib/log";
import { firstIssue } from "@/lib/validation";
import { BRAND_BUCKET, LOGO_MAX_BYTES, compCardBrand, normaliseLogo } from "@/features/compcard/brand";
import { TEXT_LIMITS } from "@/features/compcard/layout";

export const maxDuration = 30;

// The logo every comp card prints. POST: the body is the image file itself (JPEG,
// PNG or WebP, dropped onto the comp card editor); it is re-encoded as PNG, stored
// in brand-assets and becomes the logo. The previous upload is removed.
export async function POST(request: Request) {
  const auth = await requireApi("settings.manage");
  if ("response" in auth) return auth.response;
  const { supabase } = auth.context;
  if (Number(request.headers.get("content-length") ?? 0) > LOGO_MAX_BYTES) return NextResponse.json({ error: "That file is too large. Use an image under 4 MB." }, { status: 413 });
  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.byteLength) return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  if (bytes.byteLength > LOGO_MAX_BYTES) return NextResponse.json({ error: "That file is too large. Use an image under 4 MB." }, { status: 413 });

  let png: Buffer;
  try {
    png = await normaliseLogo(bytes);
  } catch {
    return NextResponse.json({ error: "That file is not a JPEG, PNG or WebP image." }, { status: 400 });
  }

  const before = await compCardBrand(supabase);
  const path = `comp-card/logo-${Date.now()}.png`;
  const upload = await supabase.storage.from(BRAND_BUCKET).upload(path, png, { contentType: "image/png", cacheControl: "31536000" });
  if (upload.error) return databaseError(upload.error, "store the logo");
  const { error } = await supabase.from("comp_card_settings").upsert({ id: true, logo_path: path }, { onConflict: "id" });
  if (error) {
    await supabase.storage.from(BRAND_BUCKET).remove([path]);
    return databaseError(error, "save the logo");
  }
  if (before.logoPath && before.logoPath !== path) {
    const removal = await supabase.storage.from(BRAND_BUCKET).remove([before.logoPath]);
    if (removal.error) log.warn("compcard", "old logo not removed", { error: removal.error.message });
  }
  await writeAudit(supabase, { action: "compcard.logo_changed", entityType: "comp_card_settings", metadata: { logo: "uploaded" } });
  return NextResponse.json({ ok: true });
}

const line = (max: number) => z.string().max(max).transform((value) => value.replace(/\s+/g, " ").trim());
const schema = z.object({
  tagline: line(TEXT_LIMITS.tagline).optional(),
  // The line under the talent's name on every card. Empty prints nothing.
  subtitle: line(TEXT_LIMITS.subtitle).optional(),
  // The contact lines on the back of every card; empty lines are dropped.
  contact: z.array(line(TEXT_LIMITS.contactLine)).max(TEXT_LIMITS.contactLines).optional()
    .transform((lines) => lines?.filter(Boolean)),
});

// PUT { tagline?, subtitle?, contact? }: the text every comp card prints unless a card
// types over it. Only the fields sent are changed.
export async function PUT(request: Request) {
  const auth = await requireApi("settings.manage");
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { supabase } = auth.context;
  const changes = Object.fromEntries(Object.entries({ tagline: parsed.data.tagline, subtitle: parsed.data.subtitle, contact_lines: parsed.data.contact }).filter(([, value]) => value !== undefined));
  if (!Object.keys(changes).length) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  const { error } = await supabase.from("comp_card_settings").upsert({ id: true, ...changes }, { onConflict: "id" });
  if (error) return databaseError(error, "save the comp card text");
  await writeAudit(supabase, { action: "compcard.defaults_changed", entityType: "comp_card_settings", metadata: { fields: Object.keys(changes) } });
  return NextResponse.json({ ok: true });
}

// Back to the built-in 42 logo and "Model Management".
export async function DELETE() {
  const auth = await requireApi("settings.manage");
  if ("response" in auth) return auth.response;
  const { supabase } = auth.context;
  const before = await compCardBrand(supabase);
  const { error } = await supabase.from("comp_card_settings").upsert({ id: true, logo_path: null, tagline: null }, { onConflict: "id" });
  if (error) return databaseError(error, "reset the logo");
  if (before.logoPath) {
    const removal = await supabase.storage.from(BRAND_BUCKET).remove([before.logoPath]);
    if (removal.error) log.warn("compcard", "old logo not removed", { error: removal.error.message });
  }
  await writeAudit(supabase, { action: "compcard.logo_changed", entityType: "comp_card_settings", metadata: { logo: "built-in" } });
  return NextResponse.json({ ok: true });
}
