// Where a talent stands with the website. Pure (no Next.js imports), shared by the
// roster, the talent header and the Website check page, and unit-tested
// (tests/unit/website-status.test.mts).
//
// The website shows a talent only when it is published, set to show, and has at
// least one photo on the website (migration 042). Board pages and the roster also
// need a public board.

export type PhotoCounts = { photos: number; approved: number; website: number };
export const NO_PHOTOS: PhotoCounts = { photos: 0, approved: 0, website: 0 };

export type WebsiteState =
  | "live"        // on the website now
  | "no_photo"    // nothing to show: no approved photo at all
  | "photos_off"  // published, but none of its photos are on the website
  | "hidden";     // not published

type Publication = { publication_status: string; show_on_website: boolean };

// `counts` is null when the viewer may not see photos: then only publication is known.
export function websiteState(talent: Publication, counts: PhotoCounts | null): WebsiteState {
  const published = talent.publication_status === "published" && talent.show_on_website;
  if (!counts) return published ? "live" : "hidden";
  if (published && counts.website > 0) return "live";
  if (counts.approved === 0) return published ? "no_photo" : "hidden";
  return published ? "photos_off" : "hidden";
}

export const WEBSITE_LABELS: Record<WebsiteState, { label: string; tone: "public" | "danger" | "private" }> = {
  live: { label: "Live", tone: "public" },
  no_photo: { label: "No photo", tone: "danger" },
  photos_off: { label: "No photo on website", tone: "danger" },
  hidden: { label: "Hidden", tone: "private" },
};

export type WebsiteRow = Publication & {
  id: string; display_name: string; archived: boolean; is_minor: boolean; consent_status: string;
  counts: PhotoCounts; boards: number; publicBoards: number;
};

// What the Website check page says about one talent, and whether "Show everyone"
// would act on it.
export type WebsiteCheck = {
  state: WebsiteState;
  // Reasons a talent is not, or not fully, on the website.
  notes: string[];
  // Can be put on the website by the bulk action.
  ready: boolean;
  // Needs a person to decide first: a minor without recorded guardian consent.
  needsConsent: boolean;
};

export function checkWebsite(row: WebsiteRow): WebsiteCheck {
  const state = websiteState(row, row.counts);
  const notes: string[] = [];
  const needsConsent = row.is_minor && row.consent_status !== "granted";
  const privatePhotos = row.counts.approved - row.counts.website;
  if (row.counts.approved === 0) notes.push(row.counts.photos ? "Photos waiting for review" : "No photo");
  if (state === "live" && privatePhotos > 0) notes.push(`${privatePhotos} photo${privatePhotos === 1 ? "" : "s"} not shown`);
  if (row.publicBoards === 0) notes.push(row.boards ? "Not on a public board" : "Not on a board");
  if (needsConsent && state !== "live") notes.push("Guardian consent not recorded");
  return { state, notes, ready: state !== "live" && row.counts.approved > 0 && !row.archived, needsConsent };
}

// The talent "Show everyone with photos" acts on, in order.
export function bulkTargets(rows: WebsiteRow[], options: { includeMinorsWithoutConsent: boolean }) {
  return rows.filter((row) => {
    const check = checkWebsite(row);
    return check.ready && (options.includeMinorsWithoutConsent || !check.needsConsent);
  });
}
