import { NextResponse } from "next/server";
import { getAgencyContext } from "@/lib/agency-auth";

export async function GET() {
  const context = await getAgencyContext();
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.authorized) return NextResponse.json({ error: "Your account is not approved for the agency dashboard" }, { status: 403 });

  const [total, published, review, drafts, boards, recent] = await Promise.all([
    context.supabase.from("talent").select("id", { count: "exact", head: true }).is("archived_at", null),
    context.supabase.from("talent").select("id", { count: "exact", head: true }).eq("publication_status", "published").eq("show_on_website", true).is("archived_at", null),
    context.supabase.from("talent").select("id", { count: "exact", head: true }).eq("publication_status", "review").is("archived_at", null),
    context.supabase.from("talent").select("id", { count: "exact", head: true }).eq("publication_status", "draft").is("archived_at", null),
    context.supabase.from("boards").select("id,name,slug,is_active,publish_to_website,internal_only").order("sort_order", { ascending: true }),
    context.supabase.from("talent").select("id,display_name,publication_status,updated_at").is("archived_at", null).order("updated_at", { ascending: false }).limit(5),
  ]);

  const failed = [total, published, review, drafts, boards, recent].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  return NextResponse.json({
    metrics: {
      totalTalent: total.count ?? 0,
      publishedTalent: published.count ?? 0,
      pendingReview: review.count ?? 0,
      drafts: drafts.count ?? 0,
    },
    boards: boards.data ?? [],
    recent: recent.data ?? [],
    upcomingEvents: 0,
    applications: 0,
    actions: [],
  });
}
