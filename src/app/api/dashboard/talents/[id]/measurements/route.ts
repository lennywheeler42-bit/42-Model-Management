import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageTalent, getAgencyContext } from "@/lib/agency-auth";

const measurementSchema = z.object({
  measured_on: z.string().trim().min(1).max(20),
  height_cm: z.coerce.number().nonnegative().optional().nullable(),
  bust_chest_cm: z.coerce.number().nonnegative().optional().nullable(),
  waist_cm: z.coerce.number().nonnegative().optional().nullable(),
  hips_cm: z.coerce.number().nonnegative().optional().nullable(),
  shoe_size_us: z.string().trim().max(30).optional().nullable(),
  hair_color: z.string().trim().max(80).optional().nullable(),
  eye_color: z.string().trim().max(80).optional().nullable(),
  weight_kg: z.coerce.number().nonnegative().optional().nullable(),
  head_cm: z.coerce.number().nonnegative().optional().nullable(),
  collar_cm: z.coerce.number().nonnegative().optional().nullable(),
  hair_length: z.string().trim().max(80).optional().nullable(),
  hair_type: z.string().trim().max(80).optional().nullable(),
  body_type: z.string().trim().max(80).optional().nullable(),
  ethnicity: z.string().trim().max(120).optional().nullable(),
  suit_size: z.string().trim().max(30).optional().nullable(),
  suit_length: z.string().trim().max(30).optional().nullable(),
  shoe_size_custom: z.string().trim().max(30).optional().nullable(),
  gloves: z.string().trim().max(30).optional().nullable(),
  inseam_cm: z.coerce.number().nonnegative().optional().nullable(),
  outseam_cm: z.coerce.number().nonnegative().optional().nullable(),
  sleeve_cm: z.coerce.number().nonnegative().optional().nullable(),
  is_official: z.boolean().optional().default(false),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getAgencyContext();
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.authorized) return NextResponse.json({ error: "Your account is not approved for the agency dashboard" }, { status: 403 });
  if (!canManageTalent(context.membership?.role)) return NextResponse.json({ error: "Talent management access required" }, { status: 403 });
  const parsed = measurementSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid measurement record" }, { status: 400 });
  const { data, error } = await context.supabase.from("talent_measurements").insert({ talent_id: id, ...parsed.data }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await context.supabase.from("audit_log").insert({ table_name: "talent_measurements", record_id: data.id, action: "create", changed_by: context.user.id, new_data: parsed.data });
  return NextResponse.json(data, { status: 201 });
}
