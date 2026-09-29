import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  publication_status: z.enum(["draft", "review", "published", "archived"]).optional(),
  show_on_website: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });

  const { data, error } = await supabase.from("talent").update({ ...parsed.data, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", id).select("id,publication_status,show_on_website").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("audit_log").insert({ table_name: "talent", record_id: id, action: "update_publication", changed_by: user.id, new_data: parsed.data });
  return NextResponse.json(data);
}
