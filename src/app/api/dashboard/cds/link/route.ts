import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseError } from "@/lib/api";
import { requireApi } from "@/lib/agency-auth";
import { firstIssue } from "@/lib/validation";

// A CDS talent held for review (same name, different date of birth) that the owner
// has confirmed is the dashboard talent of that name. Only ever links to exactly one
// unlinked talent with that exact name; the database audits the link (migration 029).
const schema = z.object({ cds_id: z.string().trim().min(1).max(40) });

export async function POST(request: Request) {
  const auth = await requireApi("integrations.manage");
  if ("response" in auth) return auth.response;
  const { supabase } = auth.context;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });

  const { data: staged, error } = await supabase.from("cds_talents").select("cds_id,first_name,last_name,match_status,talent_id").eq("cds_id", parsed.data.cds_id).maybeSingle();
  if (error) return databaseError(error, "load the CDS talent");
  if (!staged) return NextResponse.json({ error: "CDS talent not found" }, { status: 404 });
  if (staged.match_status !== "review" || staged.talent_id) return NextResponse.json({ error: "This talent is not waiting for review" }, { status: 409 });

  const escape = (value: string) => value.replace(/[%_\\]/g, (c) => `\\${c}`);
  const { data: candidates, error: candidateError } = await supabase.from("talent").select("id").is("archived_at", null)
    .ilike("first_name", escape(staged.first_name)).ilike("last_name", escape(staged.last_name));
  if (candidateError) return databaseError(candidateError, "find the talent");
  const { data: taken, error: takenError } = await supabase.from("cds_talents").select("talent_id").in("talent_id", (candidates ?? []).map((c) => c.id));
  if (takenError) return databaseError(takenError, "find the talent");
  const free = (candidates ?? []).filter((c) => !(taken ?? []).some((row) => row.talent_id === c.id));
  if (free.length !== 1) return NextResponse.json({ error: `Expected one dashboard talent named ${staged.first_name} ${staged.last_name}, found ${free.length}` }, { status: 409 });

  const now = new Date().toISOString();
  const { error: linkError } = await supabase.from("cds_talents").update({ talent_id: free[0].id, match_status: "matched", match_reason: "Confirmed by owner: same person", applied_at: now, updated_at: now }).eq("cds_id", staged.cds_id);
  if (linkError) return databaseError(linkError, "link the talent");
  return NextResponse.json({ talent_id: free[0].id });
}
