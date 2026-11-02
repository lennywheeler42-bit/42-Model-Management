import type { SupabaseClient } from "@supabase/supabase-js";

export const LIBRARY_BUCKET = "model-photos";

export type StoredPhoto = { id: string; storage_bucket: string; storage_path: string; public_storage_path: string | null; thumbnail_path?: string | null };

export function publicMediaUrl(supabase: SupabaseClient, path: string) {
  return supabase.storage.from("talent-public").getPublicUrl(path).data.publicUrl;
}

// Dashboard thumbnails: the small library thumbnail when there is one, then the
// promoted copy's public URL; private originals get a short-lived signed URL (never
// a public link).
export async function photoUrls(supabase: SupabaseClient, photos: StoredPhoto[], expiresIn = 3600) {
  const urls = new Map<string, string>();
  const toSign = new Map<string, { id: string; path: string }[]>();
  const sign = (bucket: string, id: string, path: string) => toSign.set(bucket, [...(toSign.get(bucket) ?? []), { id, path }]);
  for (const photo of photos) {
    if (photo.thumbnail_path) sign(LIBRARY_BUCKET, photo.id, photo.thumbnail_path);
    else if (photo.public_storage_path) urls.set(photo.id, publicMediaUrl(supabase, photo.public_storage_path));
    else if (photo.storage_bucket === "talent-public") urls.set(photo.id, publicMediaUrl(supabase, photo.storage_path));
    else sign(photo.storage_bucket, photo.id, photo.storage_path);
  }
  await Promise.all([...toSign].map(async ([bucket, items]) => {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(items.map((item) => item.path), expiresIn);
    for (const [index, signed] of (data ?? []).entries()) {
      if (signed.signedUrl) urls.set(items[index].id, signed.signedUrl);
    }
  }));
  return urls;
}
