import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageTalent, getAgencyContext } from "@/lib/agency-auth";

const schema = z.object({ category: z.string().trim().min(1).max(80), skill: z.string().trim().min(1).max(120), level: z.string().trim().max(40).optional().default(""), notes: z.string().trim().max(2000).optional().default(""), is_public: z.boolean().default(false) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const context = await getAgencyContext();
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.authorized || !canManageTalent(context.membership?.role)) return NextResponse.json({ error: "Talent management access required" }, { status: 403 });
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Category and skill are required" }, { status: 400 });
  const { data, error } = await context.supabase.from("talent_skills").insert({ talent_id: id, ...parsed.data }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
