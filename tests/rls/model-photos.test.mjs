// Phase 22: the model-photos library (migration 036).
// Run: node --test tests/rls/model-photos.test.mjs
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { as, createDatabase, ids, rejects, rowsAs, users } from "./harness.mjs";

let db;
const su = async (sql, params) => (await db.query(sql, params)).rows;
const file = (folder = "originals", name = "a.jpg") => `${ids.draftTalent}/${folder}/${name}`;
const insertObject = "insert into storage.objects (bucket_id, name) values ('model-photos', $1)";

before(async () => {
  db = await createDatabase();
});

describe("phase 22: model-photos bucket", () => {
  test("the bucket is private, with a size limit and images only", async () => {
    const [bucket] = await su("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'model-photos'");
    assert.equal(bucket.public, false);
    assert.equal(Number(bucket.file_size_limit), 52428800);
    assert.deepEqual(bucket.allowed_mime_types, ["image/jpeg", "image/png", "image/webp"]);
  });

  test("media managers add files only inside a talent's three folders", async () => {
    for (const folder of ["originals", "thumbnails", "cropped"]) await as(db, users.creative, insertObject, [file(folder)]);
    assert.ok(await rejects(db, users.creative, insertObject, [`${ids.draftTalent}/secrets/a.jpg`]));
    assert.ok(await rejects(db, users.creative, insertObject, ["not-a-talent/originals/a.jpg"]));
    assert.ok(await rejects(db, users.creative, insertObject, ["a.jpg"]));
  });

  test("anonymous visitors and people without media access get nothing", async () => {
    assert.deepEqual(await rowsAs(db, "anon", "select name from storage.objects where bucket_id = 'model-photos'"), []);
    assert.ok(await rejects(db, "anon", insertObject, [file("originals", "anon.jpg")]));
    assert.ok(await rejects(db, users.readOnly, insertObject, [file("originals", "evil.jpg")]));
  });

  test("staff with media.view read; only media.manage removes", async () => {
    assert.equal((await rowsAs(db, users.creative, "select name from storage.objects where bucket_id = 'model-photos'")).length, 3);
    await as(db, users.readOnly, "delete from storage.objects where bucket_id = 'model-photos'");
    assert.equal((await su("select count(*)::int as n from storage.objects where bucket_id = 'model-photos'"))[0].n, 3);
    await as(db, users.creative, "delete from storage.objects where bucket_id = 'model-photos' and name = $1", [file("cropped")]);
    assert.equal((await su("select count(*)::int as n from storage.objects where bucket_id = 'model-photos'"))[0].n, 2);
  });
});

describe("phase 22: library photos on talent_photos", () => {
  test("a photo may live in the library; other buckets are still refused", async () => {
    await as(db, users.owner, `insert into public.talent_photos (talent_id, storage_path, storage_bucket, thumbnail_path, crop) values ($1, $2, 'model-photos', $3, '{"x":0,"y":0,"width":1,"height":1,"aspect":"1:1"}')`, [ids.draftTalent, file(), file("thumbnails")]);
    assert.ok(await rejects(db, users.owner, "insert into public.talent_photos (talent_id, storage_path, storage_bucket) values ($1, 'x.jpg', 'elsewhere')", [ids.draftTalent]));
  });

  test("the new columns are not readable by anonymous visitors", async () => {
    for (const column of ["thumbnail_path", "cropped_path", "crop"]) assert.ok(await rejects(db, "anon", `select ${column} from public.talent_photos limit 1`), column);
  });

  test("a new library photo stays off the public views", async () => {
    const rows = await rowsAs(db, "anon", "select id from public.public_talent_media_view where image_path like $1", [`${ids.draftTalent}%`]);
    assert.deepEqual(rows, []);
  });
});
