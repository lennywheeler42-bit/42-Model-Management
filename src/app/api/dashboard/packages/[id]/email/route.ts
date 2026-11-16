import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseError } from "@/lib/api";
import { requireApi } from "@/lib/agency-auth";
import { log } from "@/lib/log";
import { mailerConfigured, sendMail } from "@/lib/mailer";
import { siteOrigin } from "@/lib/site";
import { firstIssue, optionalText } from "@/lib/validation";
import { BODY_MAX, SUBJECT_MAX, composeHtml, composeSubject, composeText, expiryLabel, isEmail, mailtoHref, type TemplateValues } from "@/features/packages/email";
import { hashShareToken, newShareToken } from "@/features/packages/share";

export const maxDuration = 60;

const schema = z.object({
  recipients: z.array(z.object({
    contact_id: z.string().uuid().nullable().optional(),
    email: z.string().trim().max(200).refine(isEmail, "Check the email addresses"),
    name: optionalText(160),
  })).min(1, "Choose at least one person to email").max(20, "Send to 20 people at most at a time"),
  subject: z.string().trim().min(1, "Add a subject").max(SUBJECT_MAX),
  body: z.string().trim().min(1, "Write a message").max(BODY_MAX),
  days: z.coerce.number().int().min(1).max(180).default(30),
});

// Nothing typed into a name or a title can carry control characters into a message.
const plain = (value: string | null | undefined) => (value ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] ?? null : value ?? null);

// Emails the package. Every recipient gets a private link of their own, so views are
// counted per person and one link can be stopped without the others. If the site has
// no mail server yet, the messages come back as drafts to open in the staff member's
// own email app.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  const auth = await requireApi("packages.manage");
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { supabase, user, membership } = auth.context;

  const { data: pkg, error } = await supabase.from("packages").select("id,title,message,company:company_id(name),package_items(count)").eq("id", id).maybeSingle();
  if (error) return databaseError(error, "load the package");
  if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  if (!((pkg.package_items as { count: number }[])[0]?.count)) return NextResponse.json({ error: "Add talent to the package before emailing it." }, { status: 422 });

  // One message per address; contact ids are kept only if they are real contacts.
  const recipients = parsed.data.recipients.filter((item, index, list) => list.findIndex((other) => other.email.toLowerCase() === item.email.toLowerCase()) === index);
  const contactIds = recipients.map((item) => item.contact_id).filter((value): value is string => Boolean(value));
  const known = new Set<string>();
  if (contactIds.length) {
    const { data: contacts } = await supabase.from("company_contacts").select("id").in("id", contactIds);
    for (const contact of contacts ?? []) known.add(contact.id as string);
  }

  const origin = siteOrigin() ?? new URL(request.url).origin;
  const expiresAt = new Date(Date.now() + parsed.data.days * 86400000).toISOString();
  const canSend = mailerConfigured();
  const company = plain(one(pkg.company as { name: string } | { name: string }[] | null)?.name);
  const sender = plain(membership.full_name) || "42 Model Management";

  let sent = 0;
  const failed: string[] = [];
  const drafts: { to: string; name: string | null; href: string }[] = [];
  for (const recipient of recipients) {
    const name = plain(recipient.name) || null;
    const token = newShareToken();
    const values: TemplateValues = {
      contact_name: name?.split(/\s+/)[0] || "there",
      company,
      package_title: plain(pkg.title),
      message: plain(pkg.message),
      link: `${origin}/p/${token}`,
      expires: expiryLabel(expiresAt),
      sender_name: sender,
    };
    const subject = composeSubject(parsed.data.subject, values);
    const text = composeText(parsed.data.body, values);
    const { data: row, error: insertError } = await supabase.from("package_emails").insert({
      package_id: id, contact_id: recipient.contact_id && known.has(recipient.contact_id) ? recipient.contact_id : null,
      to_email: recipient.email, to_name: name, subject, token_hash: hashShareToken(token), expires_at: expiresAt, status: canSend ? "queued" : "manual",
    }).select("id").single();
    if (insertError) return databaseError(insertError, "prepare the email");

    if (!canSend) {
      drafts.push({ to: recipient.email, name, href: mailtoHref(recipient.email, subject, text) });
      continue;
    }
    const result = await sendMail({ to: recipient.email, toName: name, subject, text, html: composeHtml(parsed.data.body, values), replyTo: user.email ?? null });
    // A link that never went out is stopped, so it cannot be used.
    const { error: updateError } = await supabase.from("package_emails")
      .update(result.ok ? { status: "sent" } : { status: "failed", revoked_at: new Date().toISOString() }).eq("id", row.id);
    if (updateError) log.warn("packages", "email status not saved", { package: id, error: updateError.message });
    if (result.ok) sent += 1; else failed.push(name ?? recipient.email);
  }

  return NextResponse.json({ sent, failed, drafts, configured: canSend });
}
