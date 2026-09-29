import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseError } from "@/lib/api";
import { ownerManagedRoles, requireApi } from "@/lib/agency-auth";
import { firstIssue } from "@/lib/validation";

const memberSchema = z.object({
  email: z.email().trim().transform((value) => value.toLowerCase()),
  fullName: z.string().trim().max(120).optional().default(""),
  role: z.enum(ownerManagedRoles),
  status: z.enum(["active", "pending", "suspended"]).default("active"),
});

export async function GET() {
  const auth = await requireApi("team.manage");
  if ("response" in auth) return auth.response;
  const { data, error } = await auth.context.supabase
    .from("agency_members")
    .select("id,email,full_name,role,status,user_id,created_at,updated_at")
    .order("created_at", { ascending: true });
  if (error) return databaseError(error, "load the team");
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = await requireApi("team.manage");
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth.context;

  const parsed = memberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });

  const { email, fullName, role, status } = parsed.data;
  const { data: existing, error: existingError } = await supabase.from("agency_members").select("id,role").eq("email", email).maybeSingle();
  if (existingError) return databaseError(existingError, "load the team");
  if (existing?.role === "owner") return NextResponse.json({ error: "Owner access is changed from the database, not the team form" }, { status: 400 });

  const payload = { email, full_name: fullName, role, status, invited_by: user.id, updated_at: new Date().toISOString() };
  const query = existing
    ? supabase.from("agency_members").update(payload).eq("id", existing.id)
    : supabase.from("agency_members").insert(payload);
  const { data: member, error } = await query.select("id,email,full_name,role,status,user_id,created_at,updated_at").single();
  if (error || !member) return databaseError(error, "save this team member");

  // The database binds the membership to the Auth user, mirrors the role onto the
  // profile, and writes the audit event (migration 009).
  return NextResponse.json(member, { status: existing ? 200 : 201 });
}
