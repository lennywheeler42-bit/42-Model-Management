import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseError, writeAudit } from "@/lib/api";
import { requireApi } from "@/lib/agency-auth";
import { firstIssue } from "@/lib/validation";
import { BODY_MAX, SUBJECT_MAX } from "@/features/packages/email";
import { PACKAGE_TEMPLATE_KEY } from "@/features/packages/queries";

const schema = z.object({
  subject: z.string().trim().min(1, "Add a subject").max(SUBJECT_MAX),
  body: z.string().trim().min(1, "Write a message").max(BODY_MAX),
});

// Saves the message every new package email starts from.
export async function PUT(request: Request) {
  const auth = await requireApi("packages.manage");
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { supabase } = auth.context;
  const { error } = await supabase.from("email_templates").upsert({ key: PACKAGE_TEMPLATE_KEY, ...parsed.data }, { onConflict: "key" });
  if (error) return databaseError(error, "save the template");
  await writeAudit(supabase, { action: "package.template_updated", entityType: "email_template", metadata: { key: PACKAGE_TEMPLATE_KEY } });
  return NextResponse.json({ ok: true });
}

// Back to the built-in message.
export async function DELETE() {
  const auth = await requireApi("packages.manage");
  if ("response" in auth) return auth.response;
  const { error } = await auth.context.supabase.from("email_templates").delete().eq("key", PACKAGE_TEMPLATE_KEY);
  if (error) return databaseError(error, "reset the template");
  return NextResponse.json({ ok: true });
}
