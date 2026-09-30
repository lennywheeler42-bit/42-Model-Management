import { NextResponse } from "next/server";
import { databaseError, writeAudit } from "@/lib/api";
import { requireApi } from "@/lib/agency-auth";
import { log } from "@/lib/log";

// Converts an application into a draft talent record (convert_application() does
// the database part in one transaction), then copies the stored application
// photos into the talent's private media. Nothing is published.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireApi(["applications.manage", "talent.create", "talent.private.edit"]);
  if ("response" in auth) return auth.response;
  const { supabase, permissions } = auth.context;

  const { data: talentId, error } = await supabase.rpc("convert_application", { p_application_id: id });
  if (error) return error.code === "P0002" ? NextResponse.json({ error: "Application not found" }, { status: 404 }) : databaseError(error, "convert the application");

  let copied = 0;
  let skipped = 0;
  if (permissions.has("media.manage")) {
    const { data: photos } = await supabase.from("application_photos").select("id,kind,storage_path").eq("application_id", id).eq("status", "stored").order("created_at");
    const { data: existing } = await supabase.from("talent_photos").select("original_file_name").eq("talent_id", talentId);
    const done = new Set((existing ?? []).map((row: { original_file_name: string | null }) => row.original_file_name));
    for (const [index, photo] of ((photos ?? []) as { id: string; kind: string; storage_path: string }[]).entries()) {
      const marker = `application-photo:${photo.id}`;
      if (done.has(marker)) continue;
      const path = `talent/${talentId}/application-${photo.id}.jpg`;
      const copy = await supabase.storage.from("applications").copy(photo.storage_path, path, { destinationBucket: "talent-private" });
      if (copy.error && !/exists/i.test(copy.error.message)) {
        log.warn("applications", "photo copy failed", { application: id, photo: photo.id, error: copy.error.message });
        skipped += 1;
        continue;
      }
      const insert = await supabase.from("talent_photos").insert({
        talent_id: talentId, storage_path: path, storage_bucket: "talent-private", public: false, publish_to_website: false,
        image_type: "digital", title: photo.kind.replace("_", " "), original_file_name: marker, mime_type: "image/jpeg", display_order: index,
      });
      if (insert.error) { skipped += 1; continue; }
      copied += 1;
    }
  }

  await writeAudit(supabase, { action: "talent.created", entityType: "talent", entityId: talentId, metadata: { from_application: id, photos_copied: copied } });
  return NextResponse.json({ talent_id: talentId, photos_copied: copied, photos_skipped: skipped, photos_need_media_permission: !permissions.has("media.manage") }, { status: 201 });
}
