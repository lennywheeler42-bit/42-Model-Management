import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerContext, ownerManagedRoles } from "@/lib/agency-auth";

const memberSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  fullName: z.string().trim().max(120).optional().default(""),
  role: z.enum(ownerManagedRoles),
  status: z.enum(["active", "pending", "suspended"]).default("active"),
});

export async function GET() {
  const context = await getOwnerContext();
  if (!context) return NextResponse.json({ error: "Owner access required" }, { status: 403 });

  const { data, error } = await context.supabase
    .from("agency_members")
    .select("id,email,full_name,role,status,created_at,updated_at")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const context = await getOwnerContext();
  if (!context) return NextResponse.json({ error: "Owner access required" }, { status: 403 });

  const parsed = memberSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Provide a valid email and role" }, { status: 400 });

  const { email, fullName, role, status } = parsed.data;
  const { data: existing, error: existingError } = await context.supabase
    .from("agency_members")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const memberPayload = { email, full_name: fullName, role, status, invited_by: context.user.id, updated_at: new Date().toISOString() };
  const memberQuery = existing
    ? context.supabase.from("agency_members").update(memberPayload).eq("id", existing.id)
    : context.supabase.from("agency_members").insert(memberPayload);
  const { data: member, error: memberError } = await memberQuery.select("id,email,full_name,role,status,created_at,updated_at").single();
  if (memberError || !member) return NextResponse.json({ error: memberError?.message ?? "Unable to save member" }, { status: 500 });

  const { data: profile } = await context.supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (profile) {
    const { data: roleRecord, error: roleError } = await context.supabase.from("roles").select("id").eq("key", role).single();
    if (roleError || !roleRecord) return NextResponse.json({ error: "Selected role is not configured" }, { status: 500 });
    await context.supabase.from("profiles").update({ full_name: fullName, role, status, updated_at: new Date().toISOString() }).eq("id", profile.id);
    await context.supabase.from("profile_roles").delete().eq("profile_id", profile.id);
    const { error: profileRoleError } = await context.supabase.from("profile_roles").insert({ profile_id: profile.id, role_id: roleRecord.id });
    if (profileRoleError) return NextResponse.json({ error: profileRoleError.message }, { status: 500 });
  }

  await context.supabase.from("audit_log").insert({ table_name: "agency_members", record_id: member.id, action: existing ? "update_access" : "grant_access", changed_by: context.user.id, new_data: { email, role, status } });
  return NextResponse.json(member, { status: existing ? 200 : 201 });
}
