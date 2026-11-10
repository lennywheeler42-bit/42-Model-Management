import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/log";
import { hasOutdatedWebCopy } from "./copies";
import { sweepCopies, writeWebCopy, type PublishablePhoto } from "./publish";
import { LIBRARY_BUCKET } from "./urls";

// "6. Update website photos" in Dashboard → CDS Import. The first CDS import put
// WebForFashion's resized files (about 950 px) on the website; the originals were
// copied into the library afterwards, privately. This rewrites the website copy of
// every photo that is on the website from its original (its crop if staff framed it),
// at the usual web size. Which photos are on the website does not change, originals
// are never altered, and a photo whose copy is already current is left alone, so it
// can be stopped and run again. Runs as the caller: RLS and storage policies apply.

type Row = PublishablePhoto & { talent_id: string; public: boolean; cropped_path: string | null };

const CONCURRENCY = 2;

// Every photo whose website copy is out of date, in id order, after `after`.
async function outdated(supabase: SupabaseClient, after: string | null) {
  const rows: Row[] = [];
  for (let start = 0; ; start += 1000) {
    let query = supabase.from("talent_photos").select("id,talent_id,storage_bucket,storage_path,public_storage_path,cropped_path,public")
      .eq("public", true).eq("storage_bucket", LIBRARY_BUCKET).not("public_storage_path", "is", null).is("archived_at", null);
    if (after) query = query.gt("id", after);
    const { data, error } = await query.order("id").range(start, start + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as Row[]).filter((photo) => hasOutdatedWebCopy(photo, LIBRARY_BUCKET)));
    if ((data ?? []).length < 1000) return rows;
  }
}

export async function outdatedWebCopyCount(supabase: SupabaseClient) {
  return (await outdated(supabase, null)).length;
}

// Saves only if the photo is still on the website with the copy it had when read, so
// a change staff make meanwhile (withdrawn, cropped, replaced) wins and this copy goes.
async function refreshOne(supabase: SupabaseClient, photo: Row) {
  const copy = await writeWebCopy(supabase, photo.talent_id, photo);
  const row = supabase.from("talent_photos").update({ public_storage_path: copy, updated_at: new Date().toISOString() })
    .eq("id", photo.id).eq("public", true).eq("public_storage_path", photo.public_storage_path as string);
  const { data, error } = await (photo.cropped_path ? row.eq("cropped_path", photo.cropped_path) : row.is("cropped_path", null)).select("id");
  if (error || !data?.length) {
    await supabase.storage.from("talent-public").remove([copy]);
    if (error) throw error;
    return false;
  }
  await sweepCopies(supabase, photo.talent_id, photo, { publicPath: copy, croppedPath: photo.cropped_path });
  return true;
}

// Works until the deadline and reports where it stopped: the page calls again with
// `next` until it is null. One pass visits each photo once, so a file that cannot be
// read is counted and passed over instead of being tried forever.
export async function refreshWebCopies(supabase: SupabaseClient, after: string | null, deadline: number) {
  const todo = await outdated(supabase, after);
  const result = { refreshed: 0, changed: 0, failed: 0, remaining: todo.length, next: after, errors: [] as string[] };
  for (let start = 0; start < todo.length; start += CONCURRENCY) {
    if (Date.now() > deadline) break;
    const group = todo.slice(start, start + CONCURRENCY);
    await Promise.all(group.map(async (photo) => {
      try {
        if (await refreshOne(supabase, photo)) result.refreshed += 1; else result.changed += 1;
      } catch (failure) {
        const message = (failure instanceof Error ? failure.message : String((failure as { message?: string })?.message ?? failure)).slice(0, 200);
        log.warn("media", "website copy not updated", { talent: photo.talent_id, photo: photo.id, error: message });
        result.failed += 1;
        if (result.errors.length < 5) result.errors.push(message);
      }
    }));
    result.remaining -= group.length;
    result.next = group[group.length - 1].id;
  }
  if (!result.remaining) result.next = null;
  return result;
}
