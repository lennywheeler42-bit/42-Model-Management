import { NextResponse } from "next/server";
import { databaseError, writeAudit } from "@/lib/api";
import { z } from "zod";
import { canManageTalent, getAgencyContext } from "@/lib/agency-auth";

// New media is always private. It reaches the public bucket only through an
// explicit promotion (PATCH /media/[photoId]).
const schema = z.object({ storage_path: z.string().trim().min(1).max(500), title: z.string().trim().max(160).optional().default(""), alt_text: z.string().trim().max(240).optional().default(""), photographer: z.string().trim().max(160).optional().default(""), image_type: z.string().trim().max(80).optional().default("portfolio") });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const context = await getAgencyContext();
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.authorized || !canManageTalent(context.membership?.role)) return NextResponse.json({ error: "Talent management access required" }, { status: 403 });
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid media metadata" }, { status: 400 });
  if (!parsed.data.storage_path.startsWith(`talent/${id}/`)) return NextResponse.json({ error: "Invalid media path" }, { status: 400 });
  const { data, error } = await context.supabase.from("talent_photos").insert({ talent_id: id, ...parsed.data, storage_bucket: "talent-private", public: false, publish_to_website: false }).select("*").single();
  if (error) return databaseError(error, "save the media record");
  await writeAudit(context.supabase, { action: "media.uploaded", entityType: "talent", entityId: id, metadata: { photo_id: data.id } });
  return NextResponse.json(data, { status: 201 });
}
