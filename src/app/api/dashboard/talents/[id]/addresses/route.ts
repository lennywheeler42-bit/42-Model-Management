import { NextResponse } from "next/server";
import { databaseError } from "@/lib/api";
import { z } from "zod";
import { canManageTalent, getAgencyContext } from "@/lib/agency-auth";

const schema = z.object({ label: z.string().trim().min(1).max(80).default("Main"), address_1: z.string().trim().max(160).optional().default(""), address_2: z.string().trim().max(160).optional().default(""), city: z.string().trim().max(100).optional().default(""), state: z.string().trim().max(100).optional().default(""), postal_code: z.string().trim().max(30).optional().default(""), country: z.string().trim().max(100).optional().default(""), phone: z.string().trim().max(80).optional().default(""), mobile: z.string().trim().max(80).optional().default(""), is_main: z.boolean().default(false), is_billing: z.boolean().default(false) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const context = await getAgencyContext();
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.authorized || !canManageTalent(context.membership?.role)) return NextResponse.json({ error: "Talent management access required" }, { status: 403 });
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  const { data, error } = await context.supabase.from("talent_addresses").insert({ talent_id: id, ...parsed.data }).select("*").single();
  if (error) return databaseError(error, "save the address");
  return NextResponse.json(data, { status: 201 });
}
