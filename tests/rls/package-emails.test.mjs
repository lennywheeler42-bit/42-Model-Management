// Migration 042: talents without a photo stay off the website and show only their
// stats in a package; packages can be emailed with a private link per recipient.
// Run: npm run test:rls
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { addMember, as, createDatabase, ids, newUser, rejects, rowsAs, users } from "./harness.mjs";

let db;
const su = async (sql, params) => (await db.query(sql, params)).rows;
const hash = (token) => createHash("sha256").update(token).digest("hex");
const shared = async (token) => (await as(db, "anon", `select public.get_shared_package('${hash(token)}') as data`)).rows[0].data;
const people = {};
let packageId;
let noPhotoId;
let contactId;
const EMAIL_TOKEN = "emailed-token-abcdefghijklmnopqrstuvwxyz012345";
const SECOND_TOKEN = "second-token-abcdefghijklmnopqrstuvwxyz0123456";

before(async () => {
  db = await createDatabase();
  people.booker = await addMember(db, newUser("booker"), "booker");
  const board = (await su("select id from public.boards where slug = 'teens-boys'"))[0].id;
  // Published and on a board, but with no photo on the website (one private photo only).
  noPhotoId = (await su(`insert into public.talent (slug, first_name, last_name, display_name, location, gender, publication_status, show_on_website, show_measurements)
    values ('no-photo', 'Nora', 'Legal', 'Nora', 'Fort Worth', 'Female', 'published', true, true) returning id`))[0].id;
  await su("insert into public.talent_board_assignments (talent_id, board_id) values ($1, $2)", [noPhotoId, board]);
  await su("insert into public.talent_measurements (talent_id, height_cm, waist_cm, hair_color) values ($1, 172, 61, 'Brown')", [noPhotoId]);
  await su(`insert into public.talent_photos (talent_id, storage_path, storage_bucket, "public", public_storage_path) values ($1, 'talent/n/private.jpg', 'talent-private', false, null)`, [noPhotoId]);
  await su(`insert into public.talent_skills (talent_id, skill_id, is_public) select $1, id, true from public.skills limit 1`, [noPhotoId]).catch(() => {});
  const companyId = (await su("insert into public.companies (name, email) values ('Acme Studio', 'hello@acme.test') returning id"))[0].id;
  contactId = (await su("insert into public.company_contacts (company_id, name, email) values ($1, 'Casey Client', 'casey@acme.test') returning id", [companyId]))[0].id;
  packageId = (await as(db, people.booker, "insert into public.packages (title, message) values ('Spring campaign', 'Two options') returning id")).rows[0].id;
  await as(db, people.booker, `insert into public.package_items (package_id, talent_id, sort_order) values ('${packageId}', '${noPhotoId}', 1), ('${packageId}', '${ids.publishedTalent}', 2)`);
});

describe("042: no photo, no place on the website", () => {
  test("a published talent without a website photo is not on the public site", async () => {
    assert.deepEqual(await rowsAs(db, "anon", "select slug from public.public_talents_view where slug = 'no-photo'"), []);
    assert.deepEqual(await rowsAs(db, "authenticated", "select slug from public.public_talents_view where slug = 'no-photo'").catch(() => []), []);
    assert.equal((await rowsAs(db, "anon", "select slug from public.public_talents_view where id = $1", [ids.publishedTalent])).length, 1, "talent with a photo stay listed");
  });

  test("nothing about them can be read anonymously from the tables either", async () => {
    assert.deepEqual(await rowsAs(db, "anon", "select display_name, location from public.talent where id = $1", [noPhotoId]), []);
    assert.deepEqual(await rowsAs(db, "anon", "select height_cm from public.talent_measurements where talent_id = $1", [noPhotoId]), []);
    assert.deepEqual(await rowsAs(db, "anon", "select board_id from public.talent_board_assignments where talent_id = $1", [noPhotoId]), []);
    assert.deepEqual(await rowsAs(db, "anon", "select * from public.public_talent_skills_view where talent_id = $1", [noPhotoId]), []);
    assert.equal((await rowsAs(db, "anon", "select id from public.talent where id = $1", [ids.publishedTalent])).length, 1);
  });

  test("they appear as soon as a photo is on the website, and leave when it is withdrawn", async () => {
    const [{ id: photo }] = await su(`insert into public.talent_photos (talent_id, storage_path, storage_bucket, "public", public_storage_path) values ($1, 'talent/n/cover.jpg', 'talent-private', true, 'talent/n/cover-public.jpg') returning id`, [noPhotoId]);
    const [row] = await rowsAs(db, "anon", "select location, height_cm, primary_image_path from public.public_talents_view where slug = 'no-photo'");
    assert.deepEqual({ ...row, height_cm: Number(row.height_cm) }, { location: "Fort Worth", height_cm: 172, primary_image_path: "talent/n/cover-public.jpg" });
    await su("update public.talent_photos set archived_at = now() where id = $1", [photo]);
    assert.deepEqual(await rowsAs(db, "anon", "select slug from public.public_talents_view where slug = 'no-photo'"), []);
    await su("delete from public.talent_photos where id = $1", [photo]);
  });

  test("anonymous visitors learn nothing but yes or no from the photo check", async () => {
    const [row] = await rowsAs(db, "anon", "select public.talent_has_website_photo($1) as no_photo, public.talent_has_website_photo($2) as has_photo", [noPhotoId, ids.publishedTalent]);
    assert.deepEqual(row, { no_photo: false, has_photo: true });
  });
});

describe("042: packages without a photo show stats only", () => {
  test("location, gender and the profile link are left out; stats stay", async () => {
    await as(db, people.booker, `update public.packages set share_token_hash = '${hash("package-own-token-abcdefghijklmnopqrstuvwxyz01")}', shared_at = now(), expires_at = now() + interval '30 days' where id = '${packageId}'`);
    const data = await shared("package-own-token-abcdefghijklmnopqrstuvwxyz01");
    const nora = data.talent.find((item) => item.name === "Nora");
    assert.deepEqual(nora.photos, []);
    assert.equal(nora.location, null);
    assert.equal(nora.gender, null);
    assert.equal(nora.profile_slug, null);
    assert.equal(nora.measurements.height_cm, 172);
    assert.ok(!JSON.stringify(nora).includes("Fort Worth"));
    const saih = data.talent.find((item) => item.name === "Saih");
    assert.equal(saih.photos.length, 1);
    assert.equal(saih.profile_slug, "saih-test", "talent with a photo keep their profile link");
  });
});

describe("042: emailed packages", () => {
  test("only package managers can record or read emails and templates", async () => {
    assert.ok(await rejects(db, users.readOnly, `insert into public.package_emails (package_id, to_email, subject, token_hash, expires_at) values ('${packageId}', 'x@y.test', 's', '${hash("nope")}', now() + interval '1 day')`));
    assert.ok(await rejects(db, users.readOnly, "insert into public.email_templates (key, subject, body) values ('package', 's', 'b')"));
    assert.ok(await rejects(db, "anon", "select to_email from public.package_emails"));
    assert.ok(await rejects(db, "anon", "select body from public.email_templates"));
    await as(db, people.booker, `insert into public.package_emails (package_id, contact_id, to_email, to_name, subject, token_hash, expires_at, status)
      values ('${packageId}', '${contactId}', 'casey@acme.test', 'Casey Client', 'Spring campaign', '${hash(EMAIL_TOKEN)}', now() + interval '30 days', 'sent')`);
    assert.deepEqual(await rowsAs(db, users.creative, "select id from public.package_emails"), []);
    assert.equal((await rowsAs(db, people.booker, "select id from public.package_emails")).length, 1);
  });

  test("the audit records the contact, never the address", async () => {
    const rows = await su("select actor_id, metadata from public.audit_logs where action = 'package.emailed' and entity_id = $1", [packageId]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].actor_id, people.booker.id);
    assert.equal(rows[0].metadata.contact_id, contactId);
    assert.ok(!JSON.stringify(rows[0].metadata).includes("casey@"));
  });

  test("an emailed link opens the package and counts that person's views", async () => {
    const data = await shared(EMAIL_TOKEN);
    assert.equal(data.title, "Spring campaign");
    assert.equal(data.talent.length, 2);
    await shared(EMAIL_TOKEN);
    const [email] = await su("select view_count, last_viewed_at from public.package_emails where token_hash = $1", [hash(EMAIL_TOKEN)]);
    assert.equal(email.view_count, 2);
    assert.ok(email.last_viewed_at);
  });

  test("an emailed link works without the package's own link, and stops when revoked or expired", async () => {
    await su("update public.packages set revoked_at = now() where id = $1", [packageId]);
    assert.ok(await shared(EMAIL_TOKEN), "each emailed link has its own life");
    await as(db, people.booker, `insert into public.package_emails (package_id, to_email, subject, token_hash, expires_at, status) values ('${packageId}', 'other@acme.test', 'Spring campaign', '${hash(SECOND_TOKEN)}', now() + interval '30 days', 'manual')`);
    await as(db, people.booker, `update public.package_emails set revoked_at = now() where token_hash = '${hash(EMAIL_TOKEN)}'`);
    assert.equal(await shared(EMAIL_TOKEN), null);
    assert.ok(await shared(SECOND_TOKEN), "stopping one link leaves the others");
    assert.equal((await su("select 1 from public.audit_logs where action = 'package.email_revoked' and entity_id = $1", [packageId])).length, 1);
    await su("update public.package_emails set expires_at = now() - interval '1 minute' where token_hash = $1", [hash(SECOND_TOKEN)]);
    assert.equal(await shared(SECOND_TOKEN), null);
  });

  test("anonymous callers cannot read token hashes or change counters", async () => {
    assert.ok(await rejects(db, "anon", "select token_hash from public.package_emails"));
    assert.ok(await rejects(db, "anon", "update public.package_emails set view_count = 0"));
  });

  test("the template is saved by package managers and stamped with who changed it", async () => {
    await as(db, people.booker, "insert into public.email_templates (key, subject, body) values ('package', 'Hello {{contact_name}}', 'See {{link}}')");
    await as(db, people.booker, "update public.email_templates set subject = 'Hi {{contact_name}}' where key = 'package'");
    const [row] = await su("select subject, updated_by from public.email_templates where key = 'package'");
    assert.deepEqual(row, { subject: "Hi {{contact_name}}", updated_by: people.booker.id });
    assert.deepEqual(await rowsAs(db, users.creative, "select key from public.email_templates"), []);
  });

  test("deleting a package removes its emailed links", async () => {
    await as(db, people.booker, `delete from public.packages where id = '${packageId}'`);
    assert.deepEqual(await su("select id from public.package_emails where package_id = $1", [packageId]), []);
  });
});
