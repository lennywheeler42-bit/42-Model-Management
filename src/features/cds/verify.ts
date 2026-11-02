import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIBRARY_BUCKET } from "@/features/media/urls";
import { isResizedSource } from "./logic";

// Compares what WebForFashion listed against what is really stored, model by model:
// each media row, its talent_photos row, and the file in model-photos. A photo only
// counts as verified if it is the original, not a resized copy, its file exists at the
// recorded size, and it belongs to that talent. A few models per request: listing a
// whole library takes longer than one request may run.

export type VerifyRow = {
  cdsId: string; name: string; talentId: string | null; status: string; note: string | null;
  listed: number; verified: number; duplicates: number; waiting: number; failed: number; missingFile: number; wrongTalent: number; thumbnails: number; bytes: number;
};

async function pages<T>(read: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await read(start, start + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

// Every file in one talent folder, name → size. Storage answers "SlowDown" when it is
// busy (a photo copy running, say), which is worth waiting out.
async function listFolder(supabase: SupabaseClient, folder: string) {
  const files = new Map<string, number>();
  for (let offset = 0; ; offset += 1000) {
    let page = await supabase.storage.from(LIBRARY_BUCKET).list(folder, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    for (let attempt = 1; page.error && attempt <= 3; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      page = await supabase.storage.from(LIBRARY_BUCKET).list(folder, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    }
    if (page.error) throw page.error;
    for (const item of page.data ?? []) if (item.id) files.set(`${folder}/${item.name}`, Number(item.metadata?.size ?? 0));
    if ((page.data ?? []).length < 1000) return files;
  }
}

export async function verifyMigration(supabase: SupabaseClient, start: number, count: number) {
  type Talent = { cds_id: string; first_name: string; last_name: string; talent_id: string | null; match_status: string; match_reason: string | null };
  const { data: all, error } = await supabase.from("cds_talents").select("cds_id,first_name,last_name,talent_id,match_status,match_reason").eq("excluded", false).order("cds_id").limit(5000);
  if (error) throw error;
  const talents = (all ?? []) as Talent[];
  const batch = talents.slice(start, start + count);
  if (!batch.length) return { total: talents.length, rows: [] as VerifyRow[] };

  const media = await pages<{ cds_id: string; status: string; photo_id: string | null }>((from, to) => supabase.from("cds_media").select("cds_id,status,photo_id").neq("kind", "video").in("cds_id", batch.map((t) => t.cds_id)).order("wff_media_id").range(from, to));
  const talentIds = batch.map((t) => t.talent_id).filter((id): id is string => Boolean(id));
  // Any source: a CDS photo identical to one staff had uploaded shares that row.
  const photos = talentIds.length ? await pages<{ id: string; talent_id: string; storage_bucket: string; storage_path: string; thumbnail_path: string | null; file_size: number | null; source_url: string | null }>((from, to) => supabase.from("talent_photos").select("id,talent_id,storage_bucket,storage_path,thumbnail_path,file_size,source_url").in("talent_id", talentIds).order("id").range(from, to)) : [];
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));

  const rows = await Promise.all(batch.map(async (talent) => {
    const own = media.filter((m) => m.cds_id === talent.cds_id);
    const row: VerifyRow = {
      cdsId: talent.cds_id, name: `${talent.first_name} ${talent.last_name}`.trim(), talentId: talent.talent_id, status: talent.match_status, note: talent.match_reason,
      listed: own.length, verified: 0, duplicates: 0, waiting: 0, failed: 0, missingFile: 0, wrongTalent: 0, thumbnails: 0, bytes: 0,
    };
    if (!talent.talent_id) { row.waiting = own.length; return row; }
    const [originals, thumbnails] = await Promise.all([listFolder(supabase, `${talent.talent_id}/originals`), listFolder(supabase, `${talent.talent_id}/thumbnails`)]);
    const seen = new Set<string>();
    for (const item of own) {
      if (item.status === "failed") { row.failed += 1; continue; }
      const photo = item.status === "imported" && item.photo_id ? photoById.get(item.photo_id) : null;
      if (item.status === "imported" && item.photo_id && !photo) { row.wrongTalent += 1; continue; }
      // Listed, or still a resized copy.
      if (!photo || photo.storage_bucket !== LIBRARY_BUCKET || isResizedSource(photo.source_url)) { row.waiting += 1; continue; }
      if (photo.talent_id !== talent.talent_id || !photo.storage_path.startsWith(`${talent.talent_id}/`)) { row.wrongTalent += 1; continue; }
      const size = originals.get(photo.storage_path);
      if (size === undefined || (photo.file_size && size !== photo.file_size)) { row.missingFile += 1; continue; }
      if (seen.has(photo.id)) { row.duplicates += 1; continue; }
      seen.add(photo.id);
      row.verified += 1;
      row.bytes += size;
      if (photo.thumbnail_path && thumbnails.has(photo.thumbnail_path)) row.thumbnails += 1;
    }
    return row;
  }));
  return { total: talents.length, rows };
}
