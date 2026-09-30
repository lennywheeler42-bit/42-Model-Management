import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseError } from "@/lib/api";
import { requireApi } from "@/lib/agency-auth";
import { firstIssue } from "@/lib/validation";

// Review status. "converted" is only reachable through /convert; the database
// records who changed the status and audits it.
const schema = z.object({ status: z.enum(["new", "reviewing", "info_requested", "approved", "rejected", "archived"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireApi("applications.manage");
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { data, error } = await auth.context.supabase.from("applications").update({ status: parsed.data.status }).eq("id", id).neq("status", "converted").select("id").maybeSingle();
  if (error) return databaseError(error, "update the application");
  if (!data) return NextResponse.json({ error: "Application not found, or already converted" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
