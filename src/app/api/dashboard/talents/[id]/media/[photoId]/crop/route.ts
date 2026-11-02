import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseError, writeAudit } from "@/lib/api";
import { requireApi } from "@/lib/agency-auth";
import { firstIssue } from "@/lib/validation";
import { libraryPath, makeCrop, readStored, storeThumbnail } from "@/features/media/library";
import { writeWebCopy } from "@/features/media/publish";
import { LIBRARY_BUCKET } from "@/features/media/urls";
import { refreshPublicSite } from "@/features/public/cache";

// The crop tool (features/media/PhotoCropDialog.tsx). The original is never changed:
// a crop is a separate file in model-photos/<talent>/cropped, and the thumbnail, the
// comp card and (if the photo is on the website) the public copy follow it.
//   GET    → a 10-minute link to the original, and the saved crop
//   POST   → save a crop
//   DELETE → back to the full photo
export const maxDuration = 60;

const fraction = z.number().min(0).max(1);
const schema = z.object({ x: fraction, y: fraction, width: fraction.positive(), height: fraction.positive(), aspect: z.string().trim().max(20) })
  .refine((crop) => crop.x + crop.width <= 1.001 && crop.y + crop.height <= 1.001, "The crop is outside the photo");

type Photo = { id: string; storage_bucket: string; storage_path: string; public_storage_path: string | null; thumbnail_path: string | null; cropped_path: string | null; crop: unknown; public: boolean; width: number | null; height: number | null };

async function loadPhoto(supabase: Parameters<typeof readStored>[0], talentId: string, photoId: string) {
  return supabase.from("talent_photos").select("id,storage_bucket,storage_path,public_storage_path,thumbnail_path,cropped_path,crop,public,width,height")
    .eq("id", photoId).eq("talent_id", talentId).is("archived_at", null).maybeSingle<Photo>();
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await params;
  const auth = await requireApi("media.manage");
  if ("response" in auth) return auth.response;
  const { supabase } = auth.context;
  const { data: photo, error } = await loadPhoto(supabase, id, photoId);
  if (error) return databaseError(error, "load the image");
  if (!photo) return NextResponse.json({ error: "Image not found" }, { status: 404 });
  const { data: signed, error: signError } = await supabase.storage.from(photo.storage_bucket).createSignedUrl(photo.storage_path, 600);
  if (signError || !signed) return databaseError(signError ?? { message: "no link" }, "open the image");
  return NextResponse.json({ url: signed.signedUrl, crop: photo.crop });
}

// Saves the row and keeps the website's copy in step with what staff framed.
async function applyChange(supabase: Parameters<typeof readStored>[0], talentId: string, photo: Photo, cropped: { cropped_path: string | null; crop: unknown }, thumbnail: string) {
  const update: Record<string, unknown> = { ...cropped, thumbnail_path: thumbnail, updated_at: new Date().toISOString() };
  const stale: string[] = [];
  if (photo.public && photo.public_storage_path) {
    update.public_storage_path = await writeWebCopy(supabase, talentId, { ...photo, cropped_path: cropped.cropped_path });
    if (photo.public_storage_path !== photo.storage_path) stale.push(photo.public_storage_path);
  }
  const { error } = await supabase.from("talent_photos").update(update).eq("id", photo.id);
  if (error) throw error;
  if (stale.length) await supabase.storage.from("talent-public").remove(stale);
  if (photo.cropped_path && photo.cropped_path !== cropped.cropped_path) await supabase.storage.from(LIBRARY_BUCKET).remove([photo.cropped_path]);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await params;
  const auth = await requireApi("media.manage");
  if ("response" in auth) return auth.response;
  refreshPublicSite();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { supabase } = auth.context;
  const { data: photo, error } = await loadPhoto(supabase, id, photoId);
  if (error) return databaseError(error, "load the image");
  if (!photo) return NextResponse.json({ error: "Image not found" }, { status: 404 });
  try {
    const original = await readStored(supabase, photo.storage_bucket, photo.storage_path);
    const cropped = await makeCrop(original, parsed.data);
    const path = libraryPath(id, "cropped", `${photo.id}-${Date.now()}.jpg`);
    const upload = await supabase.storage.from(LIBRARY_BUCKET).upload(path, cropped, { contentType: "image/jpeg" });
    if (upload.error) throw upload.error;
    const thumbnail = await storeThumbnail(supabase, photo.thumbnail_path ?? libraryPath(id, "thumbnails", `${photo.id}.jpg`), cropped);
    await applyChange(supabase, id, photo, { cropped_path: path, crop: parsed.data }, thumbnail);
    await writeAudit(supabase, { action: "media.cropped", entityType: "talent", entityId: id, metadata: { photo_id: photo.id, aspect: parsed.data.aspect } });
    return NextResponse.json({ ok: true });
  } catch (failure) {
    return databaseError(failure as { message?: string }, "crop this image");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await params;
  const auth = await requireApi("media.manage");
  if ("response" in auth) return auth.response;
  refreshPublicSite();
  const { supabase } = auth.context;
  const { data: photo, error } = await loadPhoto(supabase, id, photoId);
  if (error) return databaseError(error, "load the image");
  if (!photo) return NextResponse.json({ error: "Image not found" }, { status: 404 });
  if (!photo.cropped_path) return NextResponse.json({ ok: true });
  try {
    const original = await readStored(supabase, photo.storage_bucket, photo.storage_path);
    const thumbnail = await storeThumbnail(supabase, photo.thumbnail_path ?? libraryPath(id, "thumbnails", `${photo.id}.jpg`), original);
    await applyChange(supabase, id, photo, { cropped_path: null, crop: null }, thumbnail);
    await writeAudit(supabase, { action: "media.crop_removed", entityType: "talent", entityId: id, metadata: { photo_id: photo.id } });
    return NextResponse.json({ ok: true });
  } catch (failure) {
    return databaseError(failure as { message?: string }, "remove the crop");
  }
}
