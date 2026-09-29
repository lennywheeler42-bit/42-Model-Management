import { NextResponse } from "next/server";
import { databaseError } from "@/lib/api";
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
  if (error) return databaseError(error, "load the team");
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
  if (existingError) return databaseError(existingError, "load the team");

  const memberPayload = { email, full_name: fullName, role, status, invited_by: context.user.id, updated_at: new Date().toISOString() };
  const memberQuery = existing
    ? context.supabase.from("agency_members").update(memberPayload).eq("id", existing.id)
    : context.supabase.from("agency_members").insert(memberPayload);
  const { data: member, error: memberError } = await memberQuery.select("id,email,full_name,role,status,created_at,updated_at").single();
  if (memberError || !member) return databaseError(memberError, "save this team member");

  // The database binds the membership to the Auth user, mirrors the role onto the
  // profile, and writes the audit event (migration 009).
  return NextResponse.json(member, { status: existing ? 200 : 201 });
}
