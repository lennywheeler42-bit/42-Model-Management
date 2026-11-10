import { NextResponse } from "next/server";
import { requireApi } from "@/lib/agency-auth";
import { writeAudit } from "@/lib/api";
import { log } from "@/lib/log";
import { renderCompCard } from "@/features/compcard/build";
import { designSchema, type Design } from "@/features/compcard/layout";

export const maxDuration = 60;

// GET ?design=<JSON from the comp card editor> → PDF comp card from the talent's
// gallery. Without a design, the first photos go in the default layout.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Talent not found" }, { status: 404 });
  const auth = await requireApi(["talent.view", "media.view"]);
  if ("response" in auth) return auth.response;
  const raw = new URL(request.url).searchParams.get("design");
  let design: Design | null = null;
  if (raw) {
    let json: unknown;
    try { json = JSON.parse(raw); } catch { json = null; }
    const parsed = designSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "This comp card layout could not be read. Reload the page and try again." }, { status: 400 });
    design = parsed.data;
  }
  try {
    const result = await renderCompCard(auth.context.supabase, id, design);
    if (!result) return NextResponse.json({ error: "Talent not found" }, { status: 404 });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 422 });
    await writeAudit(auth.context.supabase, { action: "compcard.generated", entityType: "talent", entityId: id, metadata: { photos: result.photos, front: design?.front ?? null, back: design?.back ?? null, theme: design?.theme ?? null } });
    const filename = `${result.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "talent"}-comp-card.pdf`;
    return new NextResponse(new Uint8Array(result.pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    log.error("compcard", "render failed", error, { talent: id });
    return NextResponse.json({ error: "The comp card could not be generated." }, { status: 500 });
  }
}
