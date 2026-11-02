// Which stored copies of one photo can go. Pure, so it is unit-tested directly
// (tests/unit/media-crop.test.mts). `original` is the photo's own file when it lives
// in the same bucket: that is never a copy, whatever it is called.
export function staleCopies(found: string[], keep: string | null, original: string | null) {
  return [...new Set(found)].filter((path) => path !== keep && path !== original);
}
