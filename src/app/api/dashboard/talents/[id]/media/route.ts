import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseError, writeAudit } from "@/lib/api";
import { requireApi } from "@/lib/agency-auth";
import { log } from "@/lib/log";
import { firstIssue, optionalNumber, optionalText } from "@/lib/validation";
import { inspectImage, libraryPath, readStored, storeThumbnail } from "@/features/media/library";
import { LIBRARY_BUCKET } from "@/features/media/urls";
import { refreshPublicSite } from "@/features/public/cache";

export const maxDuration = 60;

// New media is always private: the original stays in model-photos and reaches the
// website only through an explicit promotion (PATCH /media/[photoId]).
const schema = z.object({
  storage_path: z.string().trim().min(1).max(500),
  title: optionalText(160),
  alt_text: optionalText(240),
  photographer: optionalText(160),
  image_type: z.string().trim().max(40).optional(),
  original_file_name: optionalText(240),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
  file_size: optionalNumber,
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireApi("media.manage");
  if ("response" in auth) return auth.response;
  refreshPublicSite();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  if (!parsed.data.storage_path.startsWith(`${id}/originals/`)) return NextResponse.json({ error: "Invalid media path" }, { status: 400 });

  const { supabase } = auth.context;
  // The browser already stored the file; check that it really is an image before recording it.
  let bytes: Buffer;
  let image: Awaited<ReturnType<typeof inspectImage>>;
  try {
    bytes = await readStored(supabase, LIBRARY_BUCKET, parsed.data.storage_path);
    image = await inspectImage(bytes);
  } catch (error) {
    log.warn("media", "upload rejected", { talent: id, error: error instanceof Error ? error.message : "unreadable" });
    await supabase.storage.from(LIBRARY_BUCKET).remove([parsed.data.storage_path]);
    return NextResponse.json({ error: "That file could not be read as an image." }, { status: 422 });
  }

  const { count } = await supabase.from("talent_photos").select("id", { count: "exact", head: true }).eq("talent_id", id).is("archived_at", null);
  const { data, error } = await supabase.from("talent_photos").insert({
    talent_id: id,
    ...parsed.data,
    image_type: parsed.data.image_type || "portfolio",
    storage_bucket: LIBRARY_BUCKET,
    public: false,
    publish_to_website: false,
    display_order: count ?? 0,
    mime_type: image.mime,
    file_size: image.fileSize,
    width: image.width,
    height: image.height,
    content_sha256: image.sha256,
  }).select("id").single();
  if (error) return databaseError(error, "save the media record");

  // Without a thumbnail the gallery falls back to the original, so this never fails the upload.
  try {
    const thumbnail = await storeThumbnail(supabase, libraryPath(id, "thumbnails", `${data.id}.jpg`), bytes);
    await supabase.from("talent_photos").update({ thumbnail_path: thumbnail }).eq("id", data.id);
  } catch (thumbnailError) {
    log.warn("media", "thumbnail failed", { talent: id, photo: data.id, error: thumbnailError instanceof Error ? thumbnailError.message : "unknown" });
  }
  await writeAudit(supabase, { action: "media.uploaded", entityType: "talent", entityId: id, metadata: { photo_id: data.id } });
  return NextResponse.json(data, { status: 201 });
}
