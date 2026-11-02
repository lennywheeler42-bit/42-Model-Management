import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseError, writeAudit } from "@/lib/api";
import { requireApi } from "@/lib/agency-auth";
import { log } from "@/lib/log";
import { firstIssue } from "@/lib/validation";
import { libraryPath, makeCrop, readStored, storeThumbnail } from "@/features/media/library";
import { sweepCopies, writeWebCopy } from "@/features/media/publish";
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

const CHANGED_MEANWHILE = "This photo was just changed somewhere else. Reopen it and try again.";

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

// Saves the row and keeps the website's copy in step with what staff framed. It saves
// only if nobody changed this photo's crop or website copy since it was loaded, so of
// two saves at once exactly one wins; the other removes its own files and returns false.
async function applyChange(supabase: Parameters<typeof readStored>[0], talentId: string, photo: Photo, cropped: { cropped_path: string | null; crop: unknown }, thumbnailPath: string, thumbnailSource: Buffer) {
  const webCopy = photo.public && photo.public_storage_path ? await writeWebCopy(supabase, talentId, { ...photo, cropped_path: cropped.cropped_path }) : null;
  const update = { ...cropped, thumbnail_path: thumbnailPath, updated_at: new Date().toISOString(), ...(webCopy ? { public_storage_path: webCopy } : {}) };
  const row = supabase.from("talent_photos").update(update).eq("id", photo.id);
  const sameCrop = photo.cropped_path ? row.eq("cropped_path", photo.cropped_path) : row.is("cropped_path", null);
  const sameCopy = photo.public_storage_path ? sameCrop.eq("public_storage_path", photo.public_storage_path) : sameCrop.is("public_storage_path", null);
  const { data, error } = await sameCopy.select("id");
  if (error) throw error;
  if (!data?.length) {
    if (webCopy) await supabase.storage.from("talent-public").remove([webCopy]);
    return false;
  }
  // Saved: from here a problem is logged, because the crop itself has gone through.
  try {
    await storeThumbnail(supabase, thumbnailPath, thumbnailSource);
  } catch (failure) {
    log.warn("media", "thumbnail not updated", { talent: talentId, photo: photo.id, error: (failure as { message?: string })?.message ?? "unknown" });
  }
  await sweepCopies(supabase, talentId, photo, { publicPath: webCopy ?? photo.public_storage_path, croppedPath: cropped.cropped_path });
  return true;
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
  const path = libraryPath(id, "cropped", `${photo.id}-${Date.now()}.jpg`);
  let uploaded = false;
  try {
    const original = await readStored(supabase, photo.storage_bucket, photo.storage_path);
    const cropped = await makeCrop(original, parsed.data);
    const upload = await supabase.storage.from(LIBRARY_BUCKET).upload(path, cropped, { contentType: "image/jpeg" });
    if (upload.error) throw upload.error;
    uploaded = true;
    const saved = await applyChange(supabase, id, photo, { cropped_path: path, crop: parsed.data }, photo.thumbnail_path ?? libraryPath(id, "thumbnails", `${photo.id}.jpg`), cropped);
    if (!saved) {
      await supabase.storage.from(LIBRARY_BUCKET).remove([path]);
      return NextResponse.json({ error: CHANGED_MEANWHILE }, { status: 409 });
    }
    await writeAudit(supabase, { action: "media.cropped", entityType: "talent", entityId: id, metadata: { photo_id: photo.id, aspect: parsed.data.aspect } });
    return NextResponse.json({ ok: true });
  } catch (failure) {
    if (uploaded) await supabase.storage.from(LIBRARY_BUCKET).remove([path]);
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
    const saved = await applyChange(supabase, id, photo, { cropped_path: null, crop: null }, photo.thumbnail_path ?? libraryPath(id, "thumbnails", `${photo.id}.jpg`), original);
    if (!saved) return NextResponse.json({ error: CHANGED_MEANWHILE }, { status: 409 });
    await writeAudit(supabase, { action: "media.crop_removed", entityType: "talent", entityId: id, metadata: { photo_id: photo.id } });
    return NextResponse.json({ ok: true });
  } catch (failure) {
    return databaseError(failure as { message?: string }, "remove the crop");
  }
}
