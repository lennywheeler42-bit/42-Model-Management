import { NextResponse } from "next/server";
import { getAgencyContext } from "@/lib/agency-auth";

export async function GET() {
  const context = await getAgencyContext();
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.authorized) return NextResponse.json({ error: "Your account is not approved for the agency dashboard" }, { status: 403 });
  const { data, error } = await context.supabase
    .from("boards")
    .select("id,name,slug,is_active,internal_only,publish_to_website,show_in_navigation")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
