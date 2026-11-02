import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/log";
import { staleCopies } from "./copies";
import { makeWebCopy, readStored } from "./library";
import { LIBRARY_BUCKET } from "./urls";

export type PublishablePhoto = { id: string; storage_path: string; storage_bucket: string; public_storage_path: string | null; cropped_path?: string | null };

// Writes the website's copy of a photo: its crop if staff framed it, else the original,
// sized for the web. Library originals can be very large, so they are never copied as is.
export async function writeWebCopy(supabase: SupabaseClient, talentId: string, photo: PublishablePhoto) {
  const source = await readStored(supabase, photo.cropped_path ? LIBRARY_BUCKET : photo.storage_bucket, photo.cropped_path ?? photo.storage_path);
  const path = `talent/${talentId}/${photo.id}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("talent-public").upload(path, await makeWebCopy(source), { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

// Publishing copies the private original into talent-public and records the copy;
// withdrawing removes the copy. The original is always preserved. Runs as the
// caller (media.manage RLS and storage policies apply). Returns the column
// changes to save, or an error from storage. `ownCopy` is a file only this call
// made, which the caller removes if its save loses to a change made meanwhile.
export async function publicCopyChanges(supabase: SupabaseClient, talentId: string, photo: PublishablePhoto, makePublic: boolean)
  : Promise<{ changes: Record<string, unknown>; ownCopy?: string; error?: { message?: string } }> {
  if (makePublic) {
    if (photo.public_storage_path) return { changes: { public: true, publish_to_website: true } };
    if (photo.storage_bucket === LIBRARY_BUCKET || photo.cropped_path) {
      try {
        const ownCopy = await writeWebCopy(supabase, talentId, photo);
        return { ownCopy, changes: { public: true, publish_to_website: true, public_storage_path: ownCopy } };
      } catch (error) {
        return { changes: {}, error: error as { message?: string } };
      }
    }
    if (photo.storage_bucket === "talent-public") return { changes: { public: true, publish_to_website: true, public_storage_path: photo.storage_path } };
    const publicPath = `talent/${talentId}/${photo.id}-${photo.storage_path.split("/").pop()}`;
    const copy = await supabase.storage.from("talent-private").copy(photo.storage_path, publicPath, { destinationBucket: "talent-public" });
    // A copy left by an earlier attempt is fine to reuse.
    if (copy.error && !/exists/i.test(copy.error.message)) return { changes: {}, error: copy.error };
    return { changes: { public: true, publish_to_website: true, public_storage_path: publicPath } };
  }
  if (photo.public_storage_path && photo.storage_bucket !== "talent-public") {
    const removal = await supabase.storage.from("talent-public").remove([photo.public_storage_path]);
    if (removal.error) return { changes: {}, error: removal.error };
  }
  return { changes: { public: false, publish_to_website: false, public_storage_path: null } };
}

// Copies of a photo are named "<photo id>-…".
async function copiesInFolder(supabase: SupabaseClient, bucket: string, folder: string, photoId: string) {
  const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000, search: `${photoId}-` });
  if (error) throw error;
  return (data ?? []).filter((item) => item.id && item.name.startsWith(`${photoId}-`)).map((item) => `${folder}/${item.name}`);
}

// Call once a change is saved: removes every website copy and crop of this photo
// except the current ones, so a withdrawn photo leaves nothing behind in the public
// bucket. The change is already saved, so a failure here is logged rather than raised.
export async function sweepCopies(supabase: SupabaseClient, talentId: string, photo: PublishablePhoto, keep: { publicPath: string | null; croppedPath: string | null }) {
  try {
    const onSite = await copiesInFolder(supabase, "talent-public", `talent/${talentId}`, photo.id);
    const stalePublic = staleCopies([...onSite, ...(photo.public_storage_path ? [photo.public_storage_path] : [])], keep.publicPath, photo.storage_bucket === "talent-public" ? photo.storage_path : null);
    if (stalePublic.length) {
      const { error } = await supabase.storage.from("talent-public").remove(stalePublic);
      if (error) throw error;
    }
    const crops = await copiesInFolder(supabase, LIBRARY_BUCKET, `${talentId}/cropped`, photo.id);
    const staleCrops = staleCopies([...crops, ...(photo.cropped_path ? [photo.cropped_path] : [])], keep.croppedPath, null);
    if (staleCrops.length) {
      const { error } = await supabase.storage.from(LIBRARY_BUCKET).remove(staleCrops);
      if (error) throw error;
    }
  } catch (error) {
    log.warn("media", "old copies not removed", { talent: talentId, photo: photo.id, error: (error as { message?: string })?.message ?? "unknown" });
  }
}
