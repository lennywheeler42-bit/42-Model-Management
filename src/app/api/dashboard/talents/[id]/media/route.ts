import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageTalent, getAgencyContext } from "@/lib/agency-auth";

const schema = z.object({ storage_path: z.string().trim().min(1).max(500), title: z.string().trim().max(160).optional().default(""), alt_text: z.string().trim().max(240).optional().default(""), photographer: z.string().trim().max(160).optional().default(""), image_type: z.string().trim().max(80).optional().default("portfolio"), public: z.boolean().default(false), featured: z.boolean().default(false) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const context = await getAgencyContext();
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.authorized || !canManageTalent(context.membership?.role)) return NextResponse.json({ error: "Talent management access required" }, { status: 403 });
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid media metadata" }, { status: 400 });
  const { data, error } = await context.supabase.from("talent_photos").insert({ talent_id: id, ...parsed.data, publish_to_website: parsed.data.public }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
