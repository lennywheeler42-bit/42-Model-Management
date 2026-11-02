// GHL sync (migration 026): mirror access, configuration rights, one talent per
// GHL contact, and the write-back queue. Run: npm run test:rls
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addMember, as, createDatabase, newUser, rejects, rowsAs, users } from "./harness.mjs";

let db;
// The sync writes with the secret key; modelled here as the superuser (no auth.uid()).
const su = async (sql, params) => (await db.query(sql, params)).rows;
const people = {};

before(async () => {
  db = await createDatabase();
  people.admin = await addMember(db, newUser("admin"), "administrator");
  people.booker = await addMember(db, newUser("booker"), "booker");
  await su(`insert into public.ghl_pipelines (id, name, purpose, badge_label, raw) values ('p-expo', 'Dallas Model and Talent Expo', 'talent', 'Model Expo', '{"secret":"raw"}')`);
  await su(`insert into public.ghl_pipeline_stages (id, pipeline_id, name, position, normalized_status, mapping_source) values ('s-enrolled', 'p-expo', 'Enrolled', 6, 'enrolled', 'initial')`);
  await su(`insert into public.ghl_field_definitions (id, object_key, name, field_key, data_type, target, ownership) values ('f-height', 'contact', 'Height', 'contact.height', 'TEXT', 'height_cm', 'bidirectional')`);
  await su(`insert into public.ghl_contacts (id, first_name, last_name, email, phone, custom_fields, raw, crm_status, programs)
    values ('c-1', 'Maya', 'Stone', 'maya@example.test', '(214) 555-0101', '{"f-height":"5ft 9"}', '{"raw":true}', 'enrolled', '{"Model Expo"}'),
           ('c-sib', 'Leo', 'Stone', 'maya@example.test', null, '{}', null, 'active', '{}')`);
  await su(`insert into public.ghl_opportunities (id, contact_id, pipeline_id, stage_id, status, raw) values ('o-1', 'c-1', 'p-expo', 's-enrolled', 'won', '{}')`);
});

describe("ghl sync: access", () => {
  test("anonymous visitors and roles without the permission see nothing", async () => {
    for (const table of ["ghl_contacts", "ghl_opportunities", "ghl_pipelines", "ghl_sync_jobs", "ghl_settings", "ghl_field_state"]) {
      assert.deepEqual(await rowsAs(db, "anon", `select * from public.${table}`), [], `anon ${table}`);
      assert.deepEqual(await rowsAs(db, users.creative, `select * from public.${table}`), [], `creative ${table}`);
      assert.deepEqual(await rowsAs(db, people.booker, `select * from public.${table}`), [], `booker ${table}`);
    }
  });

  test("talent managers read the mirror but never raw GHL payloads", async () => {
    const rows = await rowsAs(db, users.talentManager, "select id, crm_status, programs from public.ghl_contacts order by id");
    assert.deepEqual(rows.map((row) => row.id), ["c-1", "c-sib"]);
    assert.ok(await rejects(db, users.talentManager, "select raw from public.ghl_contacts"));
    assert.ok(await rejects(db, users.talentManager, "select raw from public.ghl_opportunities"));
    assert.ok(await rejects(db, users.talentManager, "select raw from public.ghl_pipelines"));
  });

  test("only integration managers change mappings, and each change is audited", async () => {
    await as(db, users.talentManager, "update public.ghl_pipeline_stages set normalized_status = 'active' where id = 's-enrolled'").catch(() => null);
    assert.equal((await su("select normalized_status from public.ghl_pipeline_stages where id = 's-enrolled'"))[0].normalized_status, "enrolled");
    await as(db, people.admin, "update public.ghl_pipeline_stages set normalized_status = 'active' where id = 's-enrolled'");
    const [stage] = await su("select normalized_status, mapping_source from public.ghl_pipeline_stages where id = 's-enrolled'");
    assert.deepEqual(stage, { normalized_status: "active", mapping_source: "staff" });
    await as(db, people.admin, "update public.ghl_pipelines set badge_label = 'Expo' where id = 'p-expo'");
    const audits = await su("select actor_id, entity_type from public.audit_logs where action = 'ghl.config_changed' order by created_at");
    assert.deepEqual(audits.map((row) => row.entity_type), ["ghl_pipeline_stages", "ghl_pipelines"]);
    assert.equal(audits[0].actor_id, people.admin.id);
    await as(db, people.admin, "update public.ghl_pipeline_stages set normalized_status = 'enrolled' where id = 's-enrolled'");
    await as(db, people.admin, "update public.ghl_pipelines set badge_label = 'Model Expo' where id = 'p-expo'");
  });

  test("staff cannot write the mirror or the queue, claim jobs, or set CRM status", async () => {
    assert.ok(await rejects(db, people.admin, "insert into public.ghl_contacts (id) values ('forged')"));
    assert.ok(await rejects(db, people.admin, "update public.ghl_contacts set crm_status = 'active' where id = 'c-1'"));
    assert.ok(await rejects(db, people.admin, "insert into public.ghl_sync_jobs (kind, external_id) values ('contact', 'c-1')"));
    assert.ok(await rejects(db, people.admin, "select * from public.ghl_claim_jobs(5)"));
    assert.ok(await rejects(db, people.admin, "update public.talent set crm_status = 'active'"));
  });

  test("CRM status and program tags are never visible to anonymous visitors", async () => {
    assert.ok(await rejects(db, "anon", "select crm_status from public.talent"));
    assert.ok(await rejects(db, "anon", "select crm_programs from public.talent"));
  });
});

describe("ghl sync: one talent per contact", () => {
  let mayaTalent;

  test("the sync creates a private draft talent once, with status and program tags", async () => {
    const [{ id }] = await su("select public.ghl_link_talent('c-1', true) as id");
    mayaTalent = id;
    const [talent] = await su("select first_name, last_name, publication_status, show_on_website, crm_status, crm_programs from public.talent where id = $1", [id]);
    assert.deepEqual(talent, { first_name: "Maya", last_name: "Stone", publication_status: "draft", show_on_website: false, crm_status: "enrolled", crm_programs: ["Model Expo"] });
    const [{ again }] = await su("select public.ghl_link_talent('c-1', true) as again");
    assert.equal(again, id, "running again links the same talent");
    assert.equal((await su("select count(*)::int as n from public.talent where first_name = 'Maya'"))[0].n, 1);
    assert.equal((await su("select count(*)::int as n from public.audit_logs where action = 'talent.created' and entity_id = $1", [id]))[0].n, 1);
  });

  test("a sibling sharing the parent's email is not merged into the same talent", async () => {
    await su("update public.talent_private_details set email = 'maya@example.test' where talent_id = $1", [mayaTalent]);
    const [{ id }] = await su("select public.ghl_link_talent('c-sib', false) as id");
    assert.equal(id, null, "different first name: no match, nothing created");
  });

  test("an existing talent with the same email and first name is linked, not duplicated", async () => {
    const [{ id: existing }] = await su("insert into public.talent (slug, first_name, last_name, display_name) values ('nia-x', 'Nia', 'Cole', 'Nia Cole') returning id");
    await su("insert into public.talent_private_details (talent_id, email) values ($1, 'NIA@example.test')", [existing]);
    await su("insert into public.ghl_contacts (id, first_name, last_name, email, crm_status) values ('c-nia', 'nia', 'Cole', 'nia@example.test', 'active')");
    const [{ id }] = await su("select public.ghl_link_talent('c-nia', true) as id");
    assert.equal(id, existing);
    assert.equal((await su("select count(*)::int as n from public.talent where lower(first_name) = 'nia'"))[0].n, 1);
  });

  test("an open application for the contact is closed, and converting later never duplicates", async () => {
    await su("insert into public.ghl_contacts (id, first_name, email, crm_status) values ('c-app', 'Ava', 'ava@example.test', 'active')");
    const [{ id: appId }] = await su("insert into public.applications (source, external_id, first_name, status) values ('ghl', 'c-app', 'Ava', 'approved') returning id");
    const [{ id: talentId }] = await su("select public.ghl_link_talent('c-app', true) as id");
    const [app] = await su("select status, converted_talent_id from public.applications where id = $1", [appId]);
    assert.deepEqual(app, { status: "converted", converted_talent_id: talentId });

    // Application converted first, contact synced afterwards: the converted talent is reused.
    await su("insert into public.ghl_contacts (id, first_name, email, crm_status) values ('c-app2', 'Ivy', 'ivy@example.test', 'active')");
    const [{ id: app2 }] = await su("insert into public.applications (source, external_id, first_name, status) values ('ghl', 'c-app2', 'Ivy', 'approved') returning id");
    const { rows: [{ converted }] } = await as(db, people.admin, `select public.convert_application('${app2}') as converted`);
    const [{ linked }] = await su("select talent_id as linked from public.ghl_contacts where id = 'c-app2'");
    assert.equal(linked, converted, "convert_application links the mirrored contact");
    const [{ again }] = await su("select public.ghl_link_talent('c-app2', true) as again");
    assert.equal(again, converted);
  });

  test("deleting a linked talent stops the sync from recreating it", async () => {
    const [{ id }] = await su("insert into public.talent (slug, first_name, last_name, display_name) values ('zoe-x', 'Zoe', 'X', 'Zoe') returning id");
    await su("insert into public.ghl_contacts (id, first_name, crm_status, talent_id) values ('c-zoe', 'Zoe', 'active', $1)", [id]);
    await su("delete from public.talent where id = $1", [id]);
    const [contact] = await su("select talent_id, auto_create_blocked from public.ghl_contacts where id = 'c-zoe'");
    assert.deepEqual(contact, { talent_id: null, auto_create_blocked: true });
  });

  test("staff need integrations.manage plus talent rights to create from a contact", async () => {
    await su("insert into public.ghl_contacts (id, first_name, crm_status) values ('c-staff', 'Kai', 'screening')");
    assert.ok(await rejects(db, users.talentManager, "select public.ghl_link_talent('c-staff', true)"));
    const { rows: [{ id }] } = await as(db, people.admin, "select public.ghl_link_talent('c-staff', true) as id");
    assert.ok(id);
    const [audit] = await su("select actor_id from public.audit_logs where action = 'talent.created' and entity_id = $1", [id]);
    assert.equal(audit.actor_id, people.admin.id);
  });
});

describe("ghl sync: write-back queue", () => {
  test("nothing is queued while write-back is off", async () => {
    const [{ talent_id: id }] = await su("select talent_id from public.ghl_contacts where id = 'c-1'");
    await as(db, people.admin, `update public.talent_private_details set mobile = '555-0199' where talent_id = '${id}'`);
    assert.equal((await su("select count(*)::int as n from public.ghl_sync_jobs"))[0].n, 0);
  });

  test("staff edits queue one push per contact; sync writes never do", async () => {
    await su("update public.ghl_settings set writeback_enabled = true");
    const [{ talent_id: id }] = await su("select talent_id from public.ghl_contacts where id = 'c-1'");
    await as(db, people.admin, `update public.talent_private_details set mobile = '555-0200' where talent_id = '${id}'`);
    await as(db, people.admin, `insert into public.talent_measurements (talent_id, height_cm) values ('${id}', 176)`);
    const jobs = await su("select kind, external_id, status from public.ghl_sync_jobs");
    assert.deepEqual(jobs, [{ kind: "push_contact", external_id: "c-1", status: "pending" }], "repeat edits collapse into one job");

    await su("update public.ghl_sync_jobs set status = 'done'");
    await su("update public.talent_private_details set mobile = '555-0300' where talent_id = $1", [id]);
    assert.equal((await su("select count(*)::int as n from public.ghl_sync_jobs where status = 'pending'"))[0].n, 0, "sync writes do not echo back");
    await su("update public.ghl_settings set writeback_enabled = false");
  });

  test("claiming jobs is atomic and retries stale running jobs", async () => {
    await su("insert into public.ghl_sync_jobs (kind, external_id) values ('contact', 'c-1'), ('contact', 'c-nia')");
    const first = await su("select external_id from public.ghl_claim_jobs(10) order by external_id");
    assert.deepEqual(first.map((row) => row.external_id), ["c-1", "c-nia"]);
    assert.deepEqual(await su("select * from public.ghl_claim_jobs(10)"), [], "running jobs are not claimed twice");
    await su("update public.ghl_sync_jobs set updated_at = now() - interval '11 minutes' where external_id = 'c-1' and status = 'running'");
    const [stale] = await su("select external_id, attempts from public.ghl_claim_jobs(10)");
    assert.deepEqual(stale, { external_id: "c-1", attempts: 2 });
  });
});

describe("migration 033: queueing GHL contacts", () => {
  test("queueing an already-queued contact is skipped, not an error; staff cannot call it", async () => {
    const [{ n: first }] = await su("select public.ghl_enqueue_jobs('contact', array['q-1', 'q-2', 'q-1'], 'test') as n");
    assert.equal(first, 2);
    const [{ n: again }] = await su("select public.ghl_enqueue_jobs('contact', array['q-1', 'q-3'], 'test') as n");
    assert.equal(again, 1, "q-1 is already open, only q-3 is new");
    await su("update public.ghl_sync_jobs set status = 'failed', next_attempt_at = now() + interval '1 hour' where external_id = 'q-2'");
    await su("select public.ghl_enqueue_jobs('contact', array['q-2'], 'test')");
    const [due] = await su("select next_attempt_at <= now() as due from public.ghl_sync_jobs where external_id = 'q-2'");
    assert.equal(due.due, true, "a failed job queued again is due now");
    assert.ok(await rejects(db, people.admin, "select public.ghl_enqueue_jobs('contact', array['x'], null)"));
  });
});

describe("migration 035: watched pipelines", () => {
  test("integration managers toggle watched; others cannot", async () => {
    await as(db, users.talentManager, "update public.ghl_pipelines set watched = true where id = 'p-expo'").catch(() => null);
    assert.equal((await su("select watched from public.ghl_pipelines where id = 'p-expo'"))[0].watched, false);
    await as(db, people.admin, "update public.ghl_pipelines set watched = true where id = 'p-expo'");
    assert.deepEqual(await rowsAs(db, users.talentManager, "select watched from public.ghl_pipelines where id = 'p-expo'"), [{ watched: true }]);
    await as(db, people.admin, "update public.ghl_pipelines set watched = false where id = 'p-expo'");
  });
});

describe("stats shown on the website", () => {
  test("an official GHL snapshot outranks an imported CDS one from the same day", async () => {
    const id = "7a1f0c52-6d3b-4c8e-9f21-3b5e8a7d1c40";
    await su(`insert into public.talent (id, slug, first_name, last_name, display_name, publication_status, show_on_website, show_measurements) values
      ('${id}', 'stats-rank', 'Stat', 'Rank', 'Stat Rank', 'published', true, true)`);
    await su(`insert into public.talent_measurements (talent_id, height_cm, source, is_official, created_at) values ('${id}', 180, 'cds', true, now() - interval '1 minute')`);
    await su(`insert into public.talent_measurements (talent_id, height_cm, source, is_official) values ('${id}', 170, 'ghl', true)`);
    const [row] = await rowsAs(db, "anon", `select height_cm from public.public_talents_view where slug = 'stats-rank'`);
    assert.equal(Number(row.height_cm), 170);
  });
});

describe("migration 040: blank stats filled from the other source", () => {
  const id = (n) => `7a1f0c52-6d3b-4c8e-9f21-3b5e8a7d2c0${n}`;
  const latest = async (talent) => (await su(`select source, is_official, height_cm::float as height, bust_chest_cm::float as bust, waist_cm::float as waist, shoe_size_us as shoe, hair_color as hair, eye_color as eyes, shirt_size as shirt
    from public.talent_measurements where talent_id = '${talent}' order by is_official desc, measured_on desc, created_at desc limit 1`))[0];
  const count = async (talent) => (await su(`select count(*)::int as n from public.talent_measurements where talent_id = '${talent}'`))[0].n;

  test("GHL values stay, CDS and GHL fill each other's blanks, and other people's contacts are never used", async () => {
    await su(`insert into public.ghl_field_definitions (id, object_key, name, target, ownership) values
      ('f-bust', 'contact', 'Bust', 'bust_cm', 'ghl_only'), ('f-waist', 'contact', 'Waist', 'waist_cm', 'ghl_only'), ('f-hair', 'contact', 'Hair', 'hair_color', 'ghl_only'), ('f-shoe', 'contact', 'Shoe', 'shoe_size', 'ghl_only')`);
    await su(`insert into public.talent (id, slug, first_name, last_name, display_name, publication_status, show_on_website) values
      ('${id(1)}', 'fill-1', 'Pipe', 'Line', 'Pipe Line', 'draft', false),
      ('${id(2)}', 'fill-2', 'Only', 'Cds', 'Only Cds', 'published', true),
      ('${id(3)}', 'fill-3', 'Kid', 'Same', 'Kid Same', 'draft', false),
      ('${id(4)}', 'fill-4', 'Other', 'Name', 'Other Name', 'draft', false),
      ('${id(5)}', 'fill-5', 'Parent', 'Same', 'Parent Same', 'draft', false)`);
    await su(`insert into public.talent_private_details (talent_id, email) values
      ('${id(2)}', 'only@example.test'), ('${id(3)}', 'shared@example.test'), ('${id(4)}', 'other@example.test'), ('${id(5)}', 'shared@example.test')
      on conflict (talent_id) do update set email = excluded.email`);
    // 1: on the pipeline; GHL's height stays, its letter shoe gives way to CDS, an inch value in a cm field from CDS is not used.
    await su(`insert into public.ghl_contacts (id, first_name, talent_id, custom_fields) values ('c-fill-1', 'Pipe', '${id(1)}', '{}')`);
    await su(`insert into public.talent_measurements (talent_id, height_cm, shoe_size_us, shirt_size, source, is_official) values ('${id(1)}', 170, 'M', 'S', 'ghl', false)`);
    await su(`insert into public.cds_talents (cds_id, talent_id, profile) values ('fill-cds-1', '${id(1)}', '{"stats":{"height_cm":"180 cm","shoe_us":"9.0","eyes_color":"Brown","bust_cm":"33 cm"}}')`);
    // 2: CDS only; GHL fills bust and hair; N/A and a letter shoe fill nothing.
    await su(`insert into public.talent_measurements (talent_id, height_cm, source, is_official) values ('${id(2)}', 175, 'cds', true)`);
    await su(`insert into public.cds_talents (cds_id, talent_id, profile) values ('fill-cds-2', '${id(2)}', '{"stats":{"height_cm":"175 cm"}}')`);
    await su(`insert into public.ghl_contacts (id, first_name, email, custom_fields) values ('c-fill-2', 'Only', 'only@example.test', '{"f-bust":"32E","f-waist":"N/A","f-hair":"Brown","f-shoe":"L"}')`);
    // 3: shares a contact's email, but that contact belongs to someone else.
    await su(`insert into public.talent_measurements (talent_id, height_cm, source, is_official) values ('${id(3)}', 150, 'cds', true)`);
    await su(`insert into public.ghl_contacts (id, first_name, email, talent_id, custom_fields) values ('c-fill-3', 'Parent', 'shared@example.test', '${id(5)}', '{"f-bust":"30"}')`);
    // 4: same email, different first name: not the same person.
    await su(`insert into public.talent_measurements (talent_id, height_cm, source, is_official) values ('${id(4)}', 160, 'cds', true)`);
    await su(`insert into public.ghl_contacts (id, first_name, email, custom_fields) values ('c-fill-4', 'Stranger', 'other@example.test', '{"f-bust":"30","f-hair":"Red"}')`);

    const migration = readFileSync(new URL("../../supabase/migrations/040_fill_blank_stats.sql", import.meta.url), "utf8");
    await db.exec(migration);

    assert.deepEqual(await latest(id(1)), { source: "cds", is_official: true, height: 170, bust: null, waist: null, shoe: "9.0", hair: null, eyes: "Brown", shirt: "S" });
    assert.deepEqual(await latest(id(2)), { source: "ghl", is_official: true, height: 175, bust: 81.3, waist: null, shoe: null, hair: "Brown", eyes: null, shirt: null });
    assert.equal(await count(id(3)), 1);
    assert.equal(await count(id(4)), 1);

    await db.exec(migration);
    assert.equal(await count(id(1)), 2);
    assert.equal(await count(id(2)), 2);
  });
});

describe("migration 039: stats saved in inches", () => {
  test("converts inch values on the two GHL snapshots only, once", async () => {
    const one = "e1adc5a5-7e07-4086-80fd-732b1b8c7320";
    const other = "7a1f0c52-6d3b-4c8e-9f21-3b5e8a7d1c41";
    await su(`insert into public.talent (id, slug, first_name, last_name, display_name, publication_status, show_on_website) values
      ('${one}', 'inches-one', 'One', 'Inches', 'One Inches', 'draft', false), ('${other}', 'inches-other', 'Other', 'Inches', 'Other Inches', 'draft', false)`);
    await su(`insert into public.talent_measurements (talent_id, bust_chest_cm, waist_cm, hips_cm, source, is_official) values
      ('${one}', 32, 62.2, 35, 'ghl', true), ('${one}', 32, 24, 35, 'cds', true), ('${other}', 32, 24, 35, 'ghl', true)`);
    const rows = (id, source) => su(`select bust_chest_cm::float as bust, waist_cm::float as waist, hips_cm::float as hips from public.talent_measurements where talent_id = '${id}' and source = '${source}'`);
    const migration = readFileSync(new URL("../../supabase/migrations/039_ghl_stats_inches_to_cm.sql", import.meta.url), "utf8");

    await db.exec(migration);
    await db.exec(migration);
    assert.deepEqual(await rows(one, "ghl"), [{ bust: 81.3, waist: 62.2, hips: 88.9 }]);
    assert.deepEqual(await rows(one, "cds"), [{ bust: 32, waist: 24, hips: 35 }]);
    assert.deepEqual(await rows(other, "ghl"), [{ bust: 32, waist: 24, hips: 35 }]);
  });
});

describe("migration 038: merging duplicate records", () => {
  const draft = "2d6907e1-7272-4acb-9425-ad707a764613";
  const keep = "03590023-9bc2-4ca4-b617-63222d8d22f0";
  const contact = "MFgJUhqGEwOFhEQkApBR";
  const migration = () => readFileSync(new URL("../../supabase/migrations/038_ghl_merge_duplicate_records.sql", import.meta.url), "utf8");

  test("the contact moves to the kept record; the draft and a re-run change nothing else", async () => {
    await su(`insert into public.talent (id, slug, first_name, last_name, display_name, publication_status, show_on_website) values
      ('${draft}', 'merge-draft', 'Sam', 'Draft', 'Sam Draft', 'draft', false), ('${keep}', 'merge-keep', 'Sammy', 'Kept', 'Sammy Kept', 'draft', false)`);
    await su(`insert into public.ghl_contacts (id, first_name, talent_id, crm_status, programs) values ('${contact}', 'Sam', '${draft}', 'active', '{"Tag"}')`);
    await su(`insert into public.applications (source, external_id, first_name, status, converted_talent_id) values ('ghl', '${contact}', 'Sam', 'converted', '${draft}')`);

    await db.exec(migration());
    assert.equal((await su(`select talent_id from public.ghl_contacts where id = '${contact}'`))[0].talent_id, keep);
    assert.deepEqual(await su(`select first_name, crm_status, crm_programs from public.talent where id = '${keep}'`), [{ first_name: "Sammy", crm_status: "active", crm_programs: ["Tag"] }]);
    assert.equal((await su(`select converted_talent_id from public.applications where external_id = '${contact}'`))[0].converted_talent_id, keep);
    assert.equal((await su(`select count(*)::int as n from public.talent where id = '${draft}' and archived_at is null`))[0].n, 1);

    // Staff link it elsewhere later: running the migration again must not undo that.
    await su(`update public.ghl_contacts set talent_id = null where id = '${contact}'`);
    await db.exec(migration());
    assert.equal((await su(`select talent_id from public.ghl_contacts where id = '${contact}'`))[0].talent_id, null);
    assert.equal((await su(`select count(*)::int as n from public.audit_logs where action = 'ghl.contact_moved' and entity_id = '${keep}'`))[0].n, 1);
  });
});

describe("migration 037: the sync watches one pipeline", () => {
  test("only the owner's pipeline is watched and its stage counts as active", async () => {
    assert.deepEqual(await su("select id, purpose from public.ghl_pipelines where watched"), [{ id: "yrD3eOpwL09Cvpaul4d5", purpose: "talent" }]);
    assert.deepEqual(await su("select pipeline_id, normalized_status from public.ghl_pipeline_stages where id = '8814e6fa-dde1-4135-9cbb-02c1d9314978'"), [{ pipeline_id: "yrD3eOpwL09Cvpaul4d5", normalized_status: "active" }]);
  });

  test("discovery refreshing the pipeline keeps the watch and the stage mapping", async () => {
    await su("insert into public.ghl_pipelines (id, name, raw, last_seen_at, removed_at) values ('yrD3eOpwL09Cvpaul4d5', 'Renamed in GHL', '{}', now(), null) on conflict (id) do update set name = excluded.name, raw = excluded.raw, last_seen_at = excluded.last_seen_at, removed_at = excluded.removed_at");
    await su("insert into public.ghl_pipeline_stages (id, pipeline_id, name, position, last_seen_at, removed_at) values ('8814e6fa-dde1-4135-9cbb-02c1d9314978', 'yrD3eOpwL09Cvpaul4d5', 'Active Models', 0, now(), null) on conflict (id) do update set name = excluded.name, position = excluded.position, last_seen_at = excluded.last_seen_at, removed_at = excluded.removed_at");
    assert.deepEqual(await su("select watched, purpose from public.ghl_pipelines where id = 'yrD3eOpwL09Cvpaul4d5'"), [{ watched: true, purpose: "talent" }]);
    assert.deepEqual(await su("select normalized_status from public.ghl_pipeline_stages where id = '8814e6fa-dde1-4135-9cbb-02c1d9314978'"), [{ normalized_status: "active" }]);
  });
});
