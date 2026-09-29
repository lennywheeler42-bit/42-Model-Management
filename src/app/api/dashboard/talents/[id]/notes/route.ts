import { NextResponse } from "next/server";
import { databaseError, writeAudit } from "@/lib/api";
import { z } from "zod";
import { canManageTalent, getAgencyContext } from "@/lib/agency-auth";

const noteSchema = z.object({ note_type: z.string().trim().max(40).default("internal"), body: z.string().trim().min(1).max(10000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getAgencyContext();
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.authorized) return NextResponse.json({ error: "Your account is not approved for the agency dashboard" }, { status: 403 });
  if (!canManageTalent(context.membership?.role)) return NextResponse.json({ error: "Talent management access required" }, { status: 403 });
  const parsed = noteSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "A note is required" }, { status: 400 });
  const { data, error } = await context.supabase.from("talent_notes").insert({ talent_id: id, created_by: context.user.id, ...parsed.data }).select("id,note_type,body,created_at").single();
  if (error) return databaseError(error, "save the note");
  await writeAudit(context.supabase, { action: "note.added", entityType: "talent", entityId: id, metadata: { note_id: data.id, note_type: parsed.data.note_type } });
  return NextResponse.json(data, { status: 201 });
}
