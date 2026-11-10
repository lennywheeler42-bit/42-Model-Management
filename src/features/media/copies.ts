// Which stored copies of one photo can go. Pure, so it is unit-tested directly
// (tests/unit/media-crop.test.mts). `original` is the photo's own file when it lives
// in the same bucket: that is never a copy, whatever it is called.
export function staleCopies(found: string[], keep: string | null, original: string | null) {
  return [...new Set(found)].filter((path) => path !== keep && path !== original);
}

// A website copy made from the photo as it is stored now is named
// "<photo id>-<time in ms>.jpg" (writeWebCopy in publish.ts).
export function isWebCopyPath(photoId: string, path: string | null | undefined) {
  const name = (path ?? "").split("/").pop() ?? "";
  return name.startsWith(`${photoId}-`) && /^\d{13}\.jpg$/.test(name.slice(photoId.length + 1));
}

// Photos on the website whose copy is older than their original: the first CDS import
// published WebForFashion's resized files (about 950 px, "<photo id>-cds-<media id>.jpg");
// the originals arrived in the library later and the website kept the small copy.
// Only library photos: elsewhere the website copy is the stored file itself.
export function hasOutdatedWebCopy(photo: { id: string; public: boolean; storage_bucket: string; public_storage_path: string | null }, libraryBucket: string) {
  return photo.public && Boolean(photo.public_storage_path) && photo.storage_bucket === libraryBucket && !isWebCopyPath(photo.id, photo.public_storage_path);
}
