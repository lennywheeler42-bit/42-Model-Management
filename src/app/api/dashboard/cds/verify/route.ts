import { NextResponse } from "next/server";
import { databaseError } from "@/lib/api";
import { requireApi } from "@/lib/agency-auth";
import { verifyMigration } from "@/features/cds/verify";

// "5. Verify photos" in Dashboard → CDS Import: read-only comparison of the
// WebForFashion list against the stored files (see features/cds/verify.ts).
//   GET ?start=0&count=8 → { total, rows }; the page calls it until it has every model.
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requireApi(["integrations.manage", "media.view"]);
  if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  const start = Math.max(0, Number(url.searchParams.get("start")) || 0);
  const count = Math.min(20, Math.max(1, Number(url.searchParams.get("count")) || 8));
  try {
    return NextResponse.json(await verifyMigration(auth.context.supabase, start, count));
  } catch (error) {
    return databaseError(error as { message?: string }, "verify the CDS photos");
  }
}
