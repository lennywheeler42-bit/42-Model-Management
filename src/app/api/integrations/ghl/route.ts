import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, after } from "next/server";
import { mapGhlPayload } from "@/features/applications/ghl";
import { storeApplicationPhotos, upsertApplication } from "@/features/applications/ingest";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

// Receives Join Us submissions from GoHighLevel (workflow "Custom Webhook" action)
// and from scripts/import-ghl.mjs. Authenticated by a shared secret: the
// X-Webhook-Secret header (or "Authorization: Bearer <secret>"), or, for GHL's
// basic Webhook action which cannot set headers, a "webhook_secret" Custom Data
// field in the body. Never in the URL. See docs/ghl-integration.md.
// Photos are downloaded after the response is sent.
export const maxDuration = 60;

const MAX_BODY = 512 * 1024;

function secretMatches(provided: string | null) {
  const expected = process.env.GHL_WEBHOOK_SECRET;
  if (!expected || expected.length < 24 || !provided) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

export async function POST(request: Request) {
  if (!process.env.GHL_WEBHOOK_SECRET) {
    log.error("ghl", "webhook called but GHL_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Integration not configured" }, { status: 503 });
  }
  const body = await request.text();
  if (body.length > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "Expected a JSON object" }, { status: 400 });

  const record = payload as Record<string, unknown> & { customData?: Record<string, unknown> };
  const bodySecret = typeof record.webhook_secret === "string" ? record.webhook_secret
    : typeof record.customData?.webhook_secret === "string" ? record.customData.webhook_secret : null;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(request.headers.get("x-webhook-secret") ?? bearer ?? bodySecret)) {
    log.warn("ghl", "webhook rejected: bad secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // The secret is never stored with the submission.
  delete record.webhook_secret;
  if (record.customData) delete record.customData.webhook_secret;
  // "intake: signed_talent" marks a model already signed in GHL (pipeline stage
  // Active Talent): the application arrives approved, ready to convert.
  const intake = [record.intake, record._intake, record.customData?.intake].find((value) => typeof value === "string");
  const signedTalent = intake === "signed_talent";
  delete record.intake;
  delete record._intake;
  if (record.customData) delete record.customData.intake;

  const fieldNames = (payload as { _fieldNames?: unknown })._fieldNames;
  const mapped = mapGhlPayload(payload, fieldNames && typeof fieldNames === "object" ? fieldNames as Record<string, string> : {});
  if (!mapped.externalId && !mapped.fields.email && !mapped.fields.phone) {
    return NextResponse.json({ error: "Submission has no contact id, email, or phone" }, { status: 422 });
  }

  try {
    const admin = createAdminSupabaseClient();
    const result = await upsertApplication(admin, mapped, payload, { signedTalent });
    after(() => storeApplicationPhotos(admin, result.id, result.photos));
    log.info("ghl", `application ${result.status}`, { application: result.id, photos: result.photos.length });
    return NextResponse.json({ ok: true, id: result.id, status: result.status, photos: result.photos.length }, { status: result.status === "created" ? 201 : 200 });
  } catch (error) {
    log.error("ghl", "application could not be saved", error);
    return NextResponse.json({ error: "Could not save the submission" }, { status: 500 });
  }
}
