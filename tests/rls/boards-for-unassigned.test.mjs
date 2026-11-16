// Migration 044: every active talent with no board is placed on one, from its CDS
// board, else its CDS portfolios, else its gender. Run: npm run test:rls
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDatabase, ids } from "./harness.mjs";

let db;
const su = async (sql, params) => (await db.query(sql, params)).rows;
const migration = readFileSync(new URL("../../supabase/migrations/044_boards_for_unassigned_talent.sql", import.meta.url), "utf8");
const boardsOf = async (slug) => (await su(`select b.name from public.talent_board_assignments a join public.boards b on b.id = a.board_id
  join public.talent t on t.id = a.talent_id where t.slug = $1 order by b.name`, [slug])).map((row) => row.name);

async function talent(slug, { gender = null, minor = false, status = "draft", archived = false, cdsBoards = null, portfolios = null } = {}) {
  const [{ id }] = await su(`insert into public.talent (slug, first_name, last_name, display_name, gender, is_minor, publication_status, archived_at)
    values ($1, 'F', 'L', $1, $2, $3, $4, $5) returning id`, [slug, gender, minor, status, archived ? new Date().toISOString() : null]);
  if (cdsBoards || portfolios) {
    await su(`insert into public.cds_talents (cds_id, wff_id, first_name, talent_id, cds_boards, portfolios) values ($1, $1, 'F', $2, $3, $4)`,
      [`cds-${slug}`, id, cdsBoards ?? [], JSON.stringify((portfolios ?? []).map((name) => ({ name, media: [] })))]);
  }
  return id;
}

before(async () => {
  db = await createDatabase();
  // The harness seeds both sample talents onto Teens / Boys; clear the draft one.
  await su("delete from public.talent_board_assignments where talent_id = $1", [ids.draftTalent]);
  await su("update public.talent set gender = 'Male' where id = $1", [ids.draftTalent]);
  const [{ id: fashionMen }] = await su("select id from public.boards where name = 'Men / Fashion'");
  await su("insert into public.cds_portfolio_boards (portfolio_name, board_id, mapping_source) values ('Fashion-Men', $1, 'auto'), ('Unmapped', null, 'none')", [fashionMen]);

  await talent("cds-main", { gender: "Female", cdsBoards: ["Women Mainboard"] });
  await talent("cds-two", { gender: "Female", cdsBoards: ["Women Development", "Women Mainboard", "Submissions"] });
  await talent("cds-teen-boy", { gender: "Male", minor: true, cdsBoards: ["Teens"] });
  await talent("cds-teen-unknown", { cdsBoards: ["Teens"] });
  // The CDS board wins over a portfolio that points somewhere else.
  await talent("cds-over-portfolio", { gender: "Male", cdsBoards: ["Men Development"], portfolios: ["Fashion-Men"] });
  await talent("portfolio-only", { cdsBoards: ["Submissions"], portfolios: ["Fashion-Men", "Unmapped"] });
  await talent("gender-woman", { gender: "Female" });
  await talent("gender-man", { gender: "male", cdsBoards: ["Archives"] });
  await talent("gender-teen-boy", { gender: "Male", minor: true });
  await talent("nothing-known", { cdsBoards: ["Submissions"] });
  await talent("archived-one", { gender: "Female", status: "archived", archived: true, cdsBoards: ["Women Mainboard"] });
  await db.exec(migration);
});

describe("044: boards for talent on none", () => {
  test("the CDS board decides first", async () => {
    assert.deepEqual(await boardsOf("cds-main"), ["Women / Fashion"]);
    assert.deepEqual(await boardsOf("cds-two"), ["Women / Development", "Women / Fashion"]);
    assert.deepEqual(await boardsOf("cds-teen-boy"), ["Teens / Boys"]);
    assert.deepEqual(await boardsOf("cds-teen-unknown"), ["Teens"]);
    assert.deepEqual(await boardsOf("cds-over-portfolio"), ["Men / Development"]);
  });

  test("then the board their CDS portfolios map to, then gender", async () => {
    assert.deepEqual(await boardsOf("portfolio-only"), ["Men / Fashion"]);
    assert.deepEqual(await boardsOf("gender-woman"), ["Women"]);
    assert.deepEqual(await boardsOf("gender-man"), ["Men"]);
    assert.deepEqual(await boardsOf("gender-teen-boy"), ["Teens / Boys"]);
    assert.deepEqual(await boardsOf("draft-test"), ["Men"], "a talent with no CDS record is placed by gender");
  });

  test("a talent with nothing to go by, or archived, is left alone", async () => {
    assert.deepEqual(await boardsOf("nothing-known"), []);
    assert.deepEqual(await boardsOf("archived-one"), []);
  });

  test("talent already on a board are not touched, and a second run changes nothing", async () => {
    assert.deepEqual(await boardsOf("saih-test"), ["Teens / Boys"]);
    const before = await su("select talent_id, board_id from public.talent_board_assignments order by 1, 2");
    // Staff move someone, then the migration runs again (e.g. a replay).
    await su("delete from public.talent_board_assignments where talent_id = (select id from public.talent where slug = 'gender-woman')");
    await su("insert into public.talent_board_assignments (talent_id, board_id) select t.id, b.id from public.talent t, public.boards b where t.slug = 'gender-woman' and b.name = 'Women / Curve'");
    await db.exec(migration);
    assert.deepEqual(await boardsOf("gender-woman"), ["Women / Curve"], "staff's choice stands");
    const after = await su("select talent_id, board_id from public.talent_board_assignments order by 1, 2");
    assert.equal(after.length, before.length);
  });

  test("placing a talent publishes nobody", async () => {
    assert.deepEqual(await su("select slug from public.talent where publication_status = 'published' and slug <> 'saih-test'"), []);
  });
});
