import { NextResponse } from "next/server";
import { databaseError, writeAudit } from "@/lib/api";
import { requireApi } from "@/lib/agency-auth";
import { log } from "@/lib/log";
import { publicCopyChanges, type PublishablePhoto } from "@/features/media/publish";
import { refreshPublicSite } from "@/features/public/cache";

// "Show all on website": makes every approved, non-archived private photo of a
// talent public (photos uploaded by the talent still need approval first). If no
// photo is primary yet, the first one in the staff order becomes the cover.
// Publishing the talent itself stays a separate step. A large book takes several
// calls: each stops in time and reports how many are left.
export const maxDuration = 60;
const TIME_BUDGET_MS = 45_000;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const auth = await requireApi("media.manage");
  if ("response" in auth) return auth.response;
  const { supabase } = auth.context;
  const started = Date.now();

  const { data, error } = await supabase.from("talent_photos")
    .select("id,storage_path,storage_bucket,public_storage_path,cropped_path,public,featured,review_status,display_order")
    .eq("talent_id", id).is("archived_at", null).order("display_order").order("created_at");
  if (error) return databaseError(error, "load the photos");
  const photos = (data ?? []) as (PublishablePhoto & { public: boolean; featured: boolean; review_status: string | null })[];

  let published = 0;
  let failed = 0;
  const waiting = photos.filter((item) => !item.public && (item.review_status ?? "approved") === "approved");
  for (const photo of waiting) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const result = await publicCopyChanges(supabase, id, photo, true);
    // Only if nobody published this photo meanwhile; otherwise this copy is not needed.
    const row = supabase.from("talent_photos").update({ ...result.changes, updated_at: new Date().toISOString() }).eq("id", photo.id);
    const saved = result.error ? { error: result.error, data: null } : await (photo.public_storage_path ? row.eq("public_storage_path", photo.public_storage_path) : row.is("public_storage_path", null)).select("id");
    if (saved.error) { failed += 1; log.warn("media", "bulk publish failed", { talent: id, photo: photo.id, error: saved.error.message ?? "" }); continue; }
    if (!saved.data?.length) {
      if (result.ownCopy) await supabase.storage.from("talent-public").remove([result.ownCopy]);
      failed += 1;
      continue;
    }
    published += 1;
  }

  if (published && !photos.some((photo) => photo.featured)) {
    const cover = photos.find((photo) => (photo.review_status ?? "approved") === "approved");
    if (cover) await supabase.rpc("set_featured_photo", { target_talent: id, photo: cover.id });
  }
  if (published) {
    refreshPublicSite();
    await writeAudit(supabase, { action: "media.published_all", entityType: "talent", entityId: id, metadata: { photos: published } });
  }
  const pendingReview = photos.filter((photo) => photo.review_status === "pending").length;
  return NextResponse.json({ published, failed, remaining: waiting.length - published - failed, pending_review: pendingReview });
}
