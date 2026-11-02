import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { downloadPhoto } from "@/features/applications/ingest";
import { inspectImage, libraryPath, storeThumbnail } from "@/features/media/library";
import { LIBRARY_BUCKET } from "@/features/media/urls";
import { writeAudit } from "@/lib/api";
import { log } from "@/lib/log";
import { slugify } from "@/lib/validation";
import { isCdsMediaUrl, pickCover, selectPhotos, sourceFileName, type MediaItem, type PortfolioRef } from "./logic";

// Photo copy for the CDS import ("4. Copy photos" in Dashboard → CDS Import).
// The owner's WebForFashion window reads each talent's signed photo links and
// posts them here; the server downloads each file from the CDS bucket and stores it
// unchanged in model-photos with a thumbnail, recorded in talent_photos (source 'cds',
// external_id = WebForFashion media id, so a re-run never copies twice). Nothing
// passes through the owner's computer. Runs as the signed-in owner: RLS and storage
// policies apply. New photos are private; nothing reaches the website until staff
// choose "Show on website".

type Linked = { cds_id: string; wff_id: string; talent_id: string; match_status: string; portfolios: PortfolioRef[] };

async function linkedTalents(supabase: SupabaseClient, wffId?: string) {
  let query = supabase.from("cds_talents").select("cds_id,wff_id,talent_id,match_status,portfolios")
    .eq("excluded", false).not("talent_id", "is", null).not("wff_id", "is", null).in("match_status", ["created", "matched"]);
  if (wffId) query = query.eq("wff_id", wffId);
  const { data, error } = await query.limit(1000);
  if (error) throw error;
  return (data ?? []) as Linked[];
}

async function mediaOf(supabase: SupabaseClient, cdsIds: string[]) {
  const rows: (MediaItem & { cds_id: string; status: string; photo_id: string | null })[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from("cds_media").select("wff_media_id,cds_id,kind,position,metadata,status,photo_id")
      .in("cds_id", cdsIds).order("wff_media_id").range(start, start + 999);
    if (error) throw error;
    rows.push(...(data ?? []).map((row) => ({ id: row.wff_media_id, cds_id: row.cds_id, kind: row.kind, position: row.position, metadata: row.metadata ?? {}, status: row.status, photo_id: row.photo_id })));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

// Photos already stored in the library. The first import kept resized copies in
// talent-private; those are replaced by the full file on the next run.
async function libraryPhotoIds(supabase: SupabaseClient, talentIds: string[]) {
  const ids = new Set<string>();
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from("talent_photos").select("id").in("talent_id", talentIds).eq("storage_bucket", LIBRARY_BUCKET).order("id").range(start, start + 999);
    if (error) throw error;
    for (const row of data ?? []) ids.add(row.id);
    if ((data ?? []).length < 1000) break;
  }
  return ids;
}

// The work list for the WebForFashion window: [{ wff_id, name, media: [ids still to
// copy] }]. Photos passed over by the earlier, selective import are listed again.
export async function planPhotos(supabase: SupabaseClient) {
  const talents = await linkedTalents(supabase);
  if (!talents.length) return { talents: [], selected: 0, imported: 0, skipped: 0 };
  const media = await mediaOf(supabase, talents.map((t) => t.cds_id));
  const inLibrary = await libraryPhotoIds(supabase, talents.map((t) => t.talent_id));
  const { data: names } = await supabase.from("talent").select("id,display_name").in("id", talents.map((t) => t.talent_id));
  const nameOf = new Map((names ?? []).map((row) => [row.id, row.display_name as string]));

  const reopen = media.filter((m) => m.status === "skipped" && m.kind !== "video").map((m) => m.id);
  for (let start = 0; start < reopen.length; start += 500) {
    const { error } = await supabase.from("cds_media").update({ status: "listed", error: null, updated_at: new Date().toISOString() }).in("wff_media_id", reopen.slice(start, start + 500));
    if (error) throw error;
  }

  const plan: { wff_id: string; name: string; media: string[] }[] = [];
  let selected = 0, imported = 0;
  for (const talent of talents) {
    const own = media.filter((m) => m.cds_id === talent.cds_id);
    const wanted = new Set(selectPhotos(own));
    const todo = own.filter((m) => wanted.has(m.id) && !(m.status === "imported" && m.photo_id && inLibrary.has(m.photo_id)));
    selected += wanted.size;
    imported += wanted.size - todo.length;
    if (wanted.size) plan.push({ wff_id: talent.wff_id, name: nameOf.get(talent.talent_id) ?? talent.cds_id, media: todo.map((m) => m.id) });
  }
  return { talents: plan, selected, imported, skipped: 0 };
}

// Network hiccups and S3 throttling are worth another try; an expired or refused
// link is not (the next run reads a fresh one).
async function withRetry<T>(work: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String((failure as { message?: string })?.message ?? failure);
      if (attempt >= attempts || /\b(400|401|403|404)\b|not allowed|too large/.test(message)) throw failure;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

const MAX_FILE_BYTES = 50 * 1024 * 1024;

// Copies the posted photos (a few per request; Vercel allows 60 s).
export async function copyPhotos(supabase: SupabaseClient, items: { id: string; url: string }[]) {
  const result = { imported: 0, upgraded: 0, duplicate: 0, failed: 0, errors: [] as string[] };
  const { data: rows, error } = await supabase.from("cds_media").select("wff_media_id,cds_id,kind,position,status,photo_id").in("wff_media_id", items.map((i) => i.id));
  if (error) throw error;
  const { data: owners, error: ownerError } = await supabase.from("cds_talents").select("cds_id,talent_id,match_status").in("cds_id", [...new Set((rows ?? []).map((r) => r.cds_id))]);
  if (ownerError) throw ownerError;
  const ownerOf = new Map((owners ?? []).map((o) => [o.cds_id, o]));

  const mark = (id: string, values: Record<string, unknown>) => supabase.from("cds_media").update({ ...values, updated_at: new Date().toISOString() }).eq("wff_media_id", id);
  const failed = async (id: string, alreadyCopied: boolean, failure: unknown) => {
    const message = (failure instanceof Error ? failure.message : String((failure as { message?: string })?.message ?? failure)).slice(0, 200);
    log.warn("cds", "photo not copied", { media: id, error: message });
    // A photo the first import already copied stays usable until its full file arrives.
    await mark(id, alreadyCopied ? { error: message } : { status: "failed", error: message });
    result.failed += 1;
    result.errors.push(`${id}: ${message}`);
  };

  const downloaded = await Promise.all(items.map(async (item) => {
    const row = (rows ?? []).find((r) => r.wff_media_id === item.id);
    const owner = row && ownerOf.get(row.cds_id);
    if (!row || !owner?.talent_id) return null;
    try {
      const url = new URL(item.url);
      if (!isCdsMediaUrl(url)) throw new Error("not a CDS media link");
      const bytes = await withRetry(() => downloadPhoto(url, MAX_FILE_BYTES, isCdsMediaUrl));
      return { item, url, row, talentId: owner.talent_id as string, matched: owner.match_status === "matched", bytes, image: await inspectImage(bytes) };
    } catch (failure) {
      await failed(item.id, Boolean(row.photo_id), failure);
      return null;
    }
  }));

  type Work = NonNullable<(typeof downloaded)[number]>;
  const store = async ({ item, url, row, talentId, matched, bytes, image }: Work) => {
    try {
      // This media id's own row if it has one, else any photo of this talent with the same bytes.
      const columns = "id,talent_id,storage_bucket";
      const { data: linked } = row.photo_id ? await supabase.from("talent_photos").select(columns).eq("id", row.photo_id).maybeSingle() : { data: null };
      if (linked && linked.talent_id !== talentId) throw new Error("this photo is linked to another talent");
      const { data: same } = linked ? { data: null } : await supabase.from("talent_photos").select(columns).eq("talent_id", talentId).eq("content_sha256", image.sha256).limit(1).maybeSingle();
      const existing = linked ?? same;
      if (existing?.storage_bucket === LIBRARY_BUCKET) {
        await mark(item.id, { status: "imported", photo_id: existing.id, error: same ? "Same file as another photo of this talent" : null });
        result.duplicate += 1;
        return;
      }

      // Named by media id, so two different photos can never share a file.
      const path = libraryPath(talentId, "originals", `cds-${item.id}.${image.extension}`);
      await withRetry(async () => {
        const stored = await supabase.storage.from(LIBRARY_BUCKET).upload(path, bytes, { contentType: image.mime, upsert: true });
        if (stored.error) throw stored.error;
      });
      const thumbnail = await withRetry(() => storeThumbnail(supabase, libraryPath(talentId, "thumbnails", `cds-${item.id}.jpg`), bytes));

      const file = {
        storage_bucket: LIBRARY_BUCKET, storage_path: path, thumbnail_path: thumbnail, original_file_name: sourceFileName(url), mime_type: image.mime,
        file_size: image.fileSize, width: image.width, height: image.height, content_sha256: image.sha256, source_url: `${url.origin}${url.pathname}`, synced_at: new Date().toISOString(),
      };
      let photoId = existing?.id as string | undefined;
      if (existing) {
        const { error: updateError } = await supabase.from("talent_photos").update(file).eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        // A talent's own photos stay ahead of the imported library.
        const { data: inserted, error: insertError } = await supabase.from("talent_photos").insert({
          ...file, talent_id: talentId, public: false, publish_to_website: false,
          image_type: row.kind === "digital" ? "digital" : "portfolio", title: row.kind === "digital" ? "Digital" : null,
          source: "cds", external_id: item.id, display_order: row.position + (matched ? 1000 : 0),
        }).select("id").single();
        // Already recorded by an earlier, interrupted run: keep that row.
        if (insertError?.code === "23505") {
          const { data: earlier, error: earlierError } = await supabase.from("talent_photos").update(file).eq("talent_id", talentId).eq("external_id", item.id).select("id").single();
          if (earlierError) throw earlierError;
          photoId = earlier.id;
        } else if (insertError) throw insertError;
        else photoId = inserted.id;
      }
      await mark(item.id, { status: "imported", photo_id: photoId, error: null });
      if (existing) result.upgraded += 1; else result.imported += 1;
    } catch (failure) {
      await failed(item.id, Boolean(row.photo_id), failure);
    }
  };

  // Identical files in one batch go one after the other, so the second is seen as a duplicate.
  const bySha = new Map<string, Work[]>();
  for (const work of downloaded) if (work) bySha.set(work.image.sha256, [...(bySha.get(work.image.sha256) ?? []), work]);
  await Promise.all([...bySha.values()].map(async (group) => { for (const work of group) await store(work); }));
  return result;
}

// Once a talent's photos are in: a profile picture if they have none, and a portfolio
// for each CDS portfolio (the same names that place them on boards) plus a Digitals
// book, created only if missing. Galleries, portfolios and covers staff have already
// arranged are never changed, and no public copies are made here.
export async function finishTalentPhotos(supabase: SupabaseClient, wffId: string) {
  const [talent] = await linkedTalents(supabase, wffId);
  if (!talent) return { cover: false, portfolios: 0, published: 0 };
  const media = await mediaOf(supabase, [talent.cds_id]);
  const copied = new Map(media.filter((m) => m.status === "imported" && m.photo_id).map((m) => [m.id, m.photo_id as string]));
  if (!copied.size) return { cover: false, portfolios: 0, published: 0 };
  const known = new Set(media.map((m) => m.id));
  const portfolios = (talent.portfolios ?? []).filter((p) => p.media.some((id) => copied.has(id)));
  const result = { cover: false, portfolios: 0, published: 0 };

  const { data: current } = await supabase.from("talent_photos").select("id").eq("talent_id", talent.talent_id).eq("featured", true).is("archived_at", null).limit(1);
  const coverId = pickCover(media, portfolios, new Set(copied.keys()));
  if (coverId && !current?.length) {
    const { error } = await supabase.rpc("set_featured_photo", { target_talent: talent.talent_id, photo: copied.get(coverId) });
    if (error) throw error;
    result.cover = true;
  }

  const { data: saved, error: savedError } = await supabase.from("portfolios").select("slug").eq("talent_id", talent.talent_id);
  if (savedError) throw savedError;
  const slugs = new Set((saved ?? []).map((row) => row.slug as string));
  for (const [index, portfolio] of portfolios.entries()) {
    const slug = slugify(portfolio.name) || `portfolio-${index + 1}`;
    // Waits until every photo in it has arrived, so a re-run never finds it half full.
    if (slugs.has(slug) || !portfolio.media.filter((id) => known.has(id)).every((id) => copied.has(id))) continue;
    const { data: created, error } = await supabase.from("portfolios").insert({
      talent_id: talent.talent_id, name: portfolio.name, slug, public: talent.match_status === "created" && Boolean(portfolio.website), display_order: index,
    }).select("id").single();
    if (error || !created) throw error ?? new Error("portfolio not saved");
    const photoIds = portfolio.media.map((id) => copied.get(id)).filter((id): id is string => Boolean(id));
    const { error: imagesError } = await supabase.rpc("set_portfolio_images", { target_portfolio: created.id, photo_ids: [...new Set(photoIds)] });
    if (imagesError) throw imagesError;
    result.portfolios += 1;
  }

  const digitals = media.filter((m) => m.kind === "digital" && copied.has(m.id)).sort((a, b) => a.position - b.position);
  if (digitals.length) {
    const { data: book } = await supabase.from("digital_books").select("id").eq("talent_id", talent.talent_id).eq("name", "Digitals").maybeSingle();
    if (!book) {
      const { data: created, error } = await supabase.from("digital_books").insert({ talent_id: talent.talent_id, name: "Digitals", public: false }).select("id").single();
      if (error || !created) throw error ?? new Error("digital book not saved");
      const { error: imagesError } = await supabase.rpc("set_digital_book_images", { target_book: created.id, photo_ids: [...new Set(digitals.map((m) => copied.get(m.id)))] });
      if (imagesError) throw imagesError;
    }
  }

  await writeAudit(supabase, { action: "talent.photos_imported", entityType: "talent", entityId: talent.talent_id, metadata: { source: "cds", photos: copied.size, portfolios: result.portfolios } });
  return result;
}
