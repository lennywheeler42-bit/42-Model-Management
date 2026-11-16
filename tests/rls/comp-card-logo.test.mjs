// Migration 043: the comp card logo and the line under it. Run: npm run test:rls
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { as, createDatabase, rejects, rowsAs, users } from "./harness.mjs";

let db;
const su = async (sql, params) => (await db.query(sql, params)).rows;

before(async () => {
  db = await createDatabase();
});

describe("043: comp card logo", () => {
  test("only settings managers change the logo; staff who see media can read it", async () => {
    // The row exists from the start (046 seeds the default text).
    await as(db, users.creative, "update public.comp_card_settings set logo_path = 'comp-card/logo-1763400000000.png'");
    assert.equal((await su("select logo_path from public.comp_card_settings"))[0].logo_path, null, "staff without settings.manage change nothing");
    await as(db, users.owner, "update public.comp_card_settings set logo_path = 'comp-card/logo-1763400000000.png'");
    assert.deepEqual(await rowsAs(db, users.creative, "select logo_path, tagline from public.comp_card_settings"), [{ logo_path: "comp-card/logo-1763400000000.png", tagline: null }]);
    await as(db, users.creative, "update public.comp_card_settings set tagline = 'Hijacked'");
    assert.equal((await su("select tagline from public.comp_card_settings"))[0].tagline, null, "an update by someone without settings.manage changes nothing");
    assert.deepEqual(await rowsAs(db, users.outsider, "select id from public.comp_card_settings"), []);
    assert.ok(await rejects(db, "anon", "select logo_path from public.comp_card_settings"));
  });

  test("there is one row, stamped with who changed it", async () => {
    await as(db, users.owner, "update public.comp_card_settings set tagline = 'Models & Talent'");
    const [row] = await su("select tagline, updated_by from public.comp_card_settings");
    assert.deepEqual(row, { tagline: "Models & Talent", updated_by: users.owner.id });
    assert.ok(await rejects(db, users.owner, "insert into public.comp_card_settings (id) values (false)"));
    assert.equal((await su("select count(*)::int as n from public.comp_card_settings"))[0].n, 1);
  });

  test("the logo path can only point at a comp card logo, and the line stays short", async () => {
    for (const bad of ["../talent-private/x.jpg", "comp-card/logo.svg", "comp-card/logo-1.png", "https://evil.test/logo.png"]) {
      assert.ok(await rejects(db, users.owner, "update public.comp_card_settings set logo_path = $1", [bad]), bad);
    }
    assert.ok(await rejects(db, users.owner, `update public.comp_card_settings set tagline = '${"x".repeat(61)}'`));
    await as(db, users.owner, "update public.comp_card_settings set logo_path = null, tagline = null");
  });

  test("only settings managers write to the brand-assets bucket", async () => {
    assert.equal((await su("select public from storage.buckets where id = 'brand-assets'"))[0].public, true);
    assert.ok(await rejects(db, users.creative, "insert into storage.objects (bucket_id, name) values ('brand-assets', 'comp-card/logo-1763400000001.png')"));
    assert.ok(await rejects(db, "anon", "insert into storage.objects (bucket_id, name) values ('brand-assets', 'comp-card/logo-1763400000001.png')"));
    await as(db, users.owner, "insert into storage.objects (bucket_id, name) values ('brand-assets', 'comp-card/logo-1763400000001.png')");
    assert.equal((await rowsAs(db, users.creative, "select name from storage.objects where bucket_id = 'brand-assets'")).length, 1, "staff can read it to print the card");
    await as(db, users.creative, "delete from storage.objects where bucket_id = 'brand-assets'");
    assert.equal((await su("select count(*)::int as n from storage.objects where bucket_id = 'brand-assets'"))[0].n, 1, "and cannot delete it");
    assert.deepEqual(await rowsAs(db, users.outsider, "select name from storage.objects where bucket_id = 'brand-assets'"), []);
    await as(db, users.owner, "delete from storage.objects where bucket_id = 'brand-assets'");
    assert.equal((await su("select count(*)::int as n from storage.objects where bucket_id = 'brand-assets'"))[0].n, 0);
  });
});

describe("046: default text on every comp card", () => {
  test("the owner's line under the name and contact lines are there from the start", async () => {
    const fresh = await createDatabase();
    assert.deepEqual((await fresh.query("select subtitle, contact_lines from public.comp_card_settings")).rows,
      [{ subtitle: "42modelmanagement.com", contact_lines: ["lenny@42modelmanagement.com", "214-463-9970"] }]);
  });

  test("only settings managers change them; staff who see media read them", async () => {
    await as(db, users.owner, "update public.comp_card_settings set subtitle = 'Models & Talent', contact_lines = array['a@example.test']");
    await as(db, users.creative, "update public.comp_card_settings set subtitle = 'Hijacked'");
    assert.deepEqual(await rowsAs(db, users.creative, "select subtitle, contact_lines from public.comp_card_settings"), [{ subtitle: "Models & Talent", contact_lines: ["a@example.test"] }]);
  });

  test("they stay short", async () => {
    assert.ok(await rejects(db, users.owner, `update public.comp_card_settings set subtitle = '${"x".repeat(81)}'`));
    assert.ok(await rejects(db, users.owner, "update public.comp_card_settings set contact_lines = array['1','2','3','4','5','6']"));
    assert.ok(await rejects(db, users.owner, `update public.comp_card_settings set contact_lines = array['${"x".repeat(320)}']`));
  });

  test("running the migration again keeps what staff saved", async () => {
    const { readFileSync } = await import("node:fs");
    await db.exec(readFileSync(new URL("../../supabase/migrations/046_comp_card_default_text.sql", import.meta.url), "utf8"));
    assert.deepEqual((await su("select subtitle, contact_lines from public.comp_card_settings"))[0], { subtitle: "Models & Talent", contact_lines: ["a@example.test"] });
  });
});

describe("042: photo counts for the roster", () => {
  test("counts follow what the caller may see", async () => {
    const [{ id }] = await su("insert into public.talent (slug, first_name, last_name, display_name) values ('count-me', 'C', 'M', 'Count Me') returning id");
    await su(`insert into public.talent_photos (talent_id, storage_path, "public", public_storage_path, review_status, archived_at) values
      ($1, 'a.jpg', true, 'a-public.jpg', 'approved', null), ($1, 'b.jpg', false, null, 'approved', null),
      ($1, 'c.jpg', false, null, 'pending', null), ($1, 'd.jpg', true, 'd-public.jpg', 'approved', now())`, [id]);
    const [row] = await rowsAs(db, users.creative, "select photos, approved, website from public.talent_photo_counts(array[$1]::uuid[])", [id]);
    assert.deepEqual(row, { photos: 3, approved: 2, website: 1 });
    assert.deepEqual(await rowsAs(db, users.outsider, "select * from public.talent_photo_counts(array[$1]::uuid[])", [id]), []);
    assert.ok(await rejects(db, "anon", "select * from public.talent_photo_counts(array[$1]::uuid[])", [id]));
  });
});
