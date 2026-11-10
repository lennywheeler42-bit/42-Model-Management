import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseError, writeAudit } from "@/lib/api";
import { requireApi } from "@/lib/agency-auth";
import { firstIssue } from "@/lib/validation";
import { refreshWebCopies } from "@/features/media/refresh";
import { refreshPublicSite } from "@/features/public/cache";

// "6. Update website photos" in Dashboard → CDS Import (see features/media/refresh.ts):
// rewrites the website copy of photos still showing the first import's small files,
// from their originals. Which photos are on the website does not change.
//   POST { after?: photo id } → { refreshed, changed, failed, remaining, next, errors }
// The page calls it again with `next` until that is null.
export const maxDuration = 60;
const TIME_BUDGET_MS = 40_000;

const bodySchema = z.object({ after: z.string().uuid().nullish() });

export async function POST(request: Request) {
  const auth = await requireApi(["integrations.manage", "media.manage"]);
  if ("response" in auth) return auth.response;
  const { supabase } = auth.context;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  try {
    const result = await refreshWebCopies(supabase, parsed.data.after ?? null, Date.now() + TIME_BUDGET_MS);
    if (result.refreshed) {
      refreshPublicSite();
      await writeAudit(supabase, { action: "media.website_copies_updated", entityType: "media", metadata: { photos: result.refreshed, failed: result.failed } });
    }
    return NextResponse.json(result);
  } catch (error) {
    return databaseError(error as { message?: string }, "update the website photos");
  }
}
