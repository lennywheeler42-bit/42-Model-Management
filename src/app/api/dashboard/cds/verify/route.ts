import { NextResponse } from "next/server";
import { databaseError } from "@/lib/api";
import { requireApi } from "@/lib/agency-auth";
import { verifyMigration } from "@/features/cds/verify";

// "5. Verify photos" in Dashboard → CDS Import: read-only comparison of the
// WebForFashion list against the stored files (see features/cds/verify.ts).
export const maxDuration = 60;

export async function GET() {
  const auth = await requireApi(["integrations.manage", "media.view"]);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json(await verifyMigration(auth.context.supabase));
  } catch (error) {
    return databaseError(error as { message?: string }, "verify the CDS photos");
  }
}
