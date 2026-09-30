import { revalidateTag, unstable_cache } from "next/cache";
import { after } from "next/server";

// Every public read is cached under one tag and refreshed at most every five
// minutes. Staff changes clear it immediately via refreshPublicSite(), so
// publishing still shows on the next page view.
export const PUBLIC_SITE_TAG = "public-site";

export function publicCache<Args extends unknown[], Result>(fn: (...args: Args) => Promise<Result>, key: string) {
  return unstable_cache(fn, ["public", key], { tags: [PUBLIC_SITE_TAG], revalidate: 300 });
}

// Call from dashboard route handlers that can change anything the public site
// shows. It runs after the response is sent, so the write has completed and a
// concurrent visitor cannot re-cache the old data.
export function refreshPublicSite() {
  after(() => revalidateTag(PUBLIC_SITE_TAG, { expire: 0 }));
}
