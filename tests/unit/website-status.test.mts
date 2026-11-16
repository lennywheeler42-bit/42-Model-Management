// Website status of a talent (roster, talent header, Website check). Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { bulkTargets, checkWebsite, websiteState, type WebsiteRow } from "../../src/features/talent/website.ts";

const published = { publication_status: "published", show_on_website: true };
const draft = { publication_status: "draft", show_on_website: false };
const row = (over: Partial<WebsiteRow>): WebsiteRow => ({
  id: "t1", display_name: "Test", archived: false, is_minor: false, consent_status: "not_required",
  counts: { photos: 4, approved: 4, website: 0 }, boards: 1, publicBoards: 1, ...draft, ...over,
});

test("a published talent is live only with a photo on the website", () => {
  assert.equal(websiteState(published, { photos: 3, approved: 3, website: 1 }), "live");
  assert.equal(websiteState(published, { photos: 0, approved: 0, website: 0 }), "no_photo");
  assert.equal(websiteState(published, { photos: 3, approved: 3, website: 0 }), "photos_off");
  // Photos a talent sent that nobody approved yet do not count.
  assert.equal(websiteState(published, { photos: 2, approved: 0, website: 0 }), "no_photo");
});

test("an unpublished talent is hidden, whatever photos it has", () => {
  assert.equal(websiteState(draft, { photos: 3, approved: 3, website: 3 }), "hidden");
  assert.equal(websiteState({ publication_status: "published", show_on_website: false }, { photos: 3, approved: 3, website: 3 }), "hidden");
});

test("without photo counts the status falls back to publication alone", () => {
  assert.equal(websiteState(published, null), "live");
  assert.equal(websiteState(draft, null), "hidden");
});

test("the check explains why a talent is not on the website", () => {
  assert.deepEqual(checkWebsite(row({ counts: { photos: 0, approved: 0, website: 0 } })).notes, ["No photo"]);
  assert.deepEqual(checkWebsite(row({ counts: { photos: 2, approved: 0, website: 0 } })).notes, ["Photos waiting for review"]);
  assert.deepEqual(checkWebsite(row({ boards: 0, publicBoards: 0 })).notes, ["Not on a board"]);
  assert.deepEqual(checkWebsite(row({ boards: 2, publicBoards: 0 })).notes, ["Not on a public board"]);
  assert.deepEqual(checkWebsite(row({ ...published, counts: { photos: 5, approved: 5, website: 3 } })).notes, ["2 photos not shown"]);
  assert.deepEqual(checkWebsite(row({ is_minor: true, consent_status: "pending" })).notes, ["Guardian consent not recorded"]);
});

test("the bulk action takes talent with photos who are not live, and never those without", () => {
  const rows = [
    row({ id: "ready" }),
    row({ id: "live", ...published, counts: { photos: 4, approved: 4, website: 4 } }),
    row({ id: "no-photo", counts: { photos: 0, approved: 0, website: 0 } }),
    row({ id: "published-no-photo", ...published, counts: { photos: 0, approved: 0, website: 0 } }),
    row({ id: "published-photos-off", ...published }),
    row({ id: "minor", is_minor: true, consent_status: "pending" }),
    row({ id: "minor-consented", is_minor: true, consent_status: "granted" }),
  ];
  assert.deepEqual(bulkTargets(rows, { includeMinorsWithoutConsent: false }).map((item) => item.id), ["ready", "published-photos-off", "minor-consented"]);
  assert.deepEqual(bulkTargets(rows, { includeMinorsWithoutConsent: true }).map((item) => item.id), ["ready", "published-photos-off", "minor", "minor-consented"]);
});
