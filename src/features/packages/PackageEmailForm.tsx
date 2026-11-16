"use client";

import { useState } from "react";
import { ExternalLink, Mail, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SelectField, TextareaField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import { useMutation } from "@/lib/use-mutation";
import { MAX_RECIPIENTS, composeSubject, composeText, expiryLabel, parseAddresses, plainBody, subjectFor, type EmailTemplate } from "./email";
import type { PackageEmailRow, PackageOption, Person } from "./queries";

type Draft = { to: string; name: string | null; href: string };
type SendResult = { sent: number; failed: string[]; drafts: Draft[]; configured: boolean };

const DAYS = [{ value: "7", label: "7 days" }, { value: "14", label: "14 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }];
const untilLabel = (days: string) => expiryLabel(new Date(Date.now() + Number(days) * 86400000).toISOString());

// Writes and sends the email for a package. Used on the package page (package fixed,
// people chosen from the client) and from Contacts and Companies (people fixed,
// package chosen). Staff write a subject and a message in plain words; the greeting
// with each person's name, their private link, the date it ends, the sender's name
// and the no-reply note are added when it is sent. The wording starts from the saved
// template and can be changed for this email, or saved for the next ones.
export function PackageEmailForm({ packages, people, preselected = [], template, mailReady, senderName, contactEmail, before }: {
  packages: PackageOption[]; people: Person[]; preselected?: string[]; template: EmailTemplate; mailReady: boolean; senderName: string;
  // Where replies should go: the site's own mailbox is not read.
  contactEmail: string;
  // Runs before sending, e.g. to save the package; sending stops if it returns false.
  before?: () => Promise<boolean>;
}) {
  const toast = useToast();
  const { run, pending } = useMutation();
  const [packageId, setPackageId] = useState(packages.length === 1 ? packages[0].id : "");
  // Ticks the user changed; everyone else follows `preselected`.
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [extra, setExtra] = useState("");
  // What staff typed; until they type, the subject and message follow the template
  // (and the subject follows the package chosen).
  const [typedSubject, setTypedSubject] = useState<string | null>(null);
  const [typedBody, setTypedBody] = useState<string | null>(null);
  const [days, setDays] = useState("30");
  // The preview's end date, worked out when the preview is opened or the days change.
  const [previewUntil, setPreviewUntil] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const chosen = people.filter((person) => ticks[person.key] ?? preselected.includes(person.key));
  const pkg = packages.find((item) => item.id === packageId) ?? null;
  const typed = parseAddresses(extra);
  const others = typed.valid.filter((email) => !chosen.some((person) => person.email.toLowerCase() === email.toLowerCase()));
  const count = chosen.length + others.length;
  const templateSubject = subjectFor(template.subject, pkg?.title);
  const templateBody = plainBody(template.body);
  const subject = typedSubject ?? templateSubject;
  const body = typedBody ?? templateBody;
  const changed = subject !== templateSubject || body !== templateBody;
  const firstName = chosen[0]?.name.split(/\s+/)[0] ?? null;

  async function send() {
    if (!pkg) { toast.error("Choose a package first."); return; }
    if (typed.invalid.length) { toast.error(`Check ${typed.invalid.length === 1 ? "this address" : "these addresses"}: ${typed.invalid.join(", ")}`); return; }
    if (!count) { toast.error("Choose at least one person to email."); return; }
    if (count > MAX_RECIPIENTS) { toast.error(`Send to ${MAX_RECIPIENTS} people at most at a time.`); return; }
    if (before && !(await before())) return;
    const recipients = [
      ...chosen.map((person) => ({ contact_id: person.contact_id, email: person.email, name: person.name })),
      ...others.map((email) => ({ contact_id: null, email, name: "" })),
    ];
    const result = await run<SendResult>(`/api/dashboard/packages/${pkg.id}/email`, { body: { recipients, subject, body, days: Number(days) } });
    if (!result) return;
    if (result.failed.length) toast.error(`Could not be sent to ${result.failed.join(", ")}. Check the address and try again.`);
    if (result.sent) toast.success(`Email sent to ${result.sent} ${result.sent === 1 ? "person" : "people"}`);
    setDrafts(result.drafts);
    if (result.drafts.length === 1) window.location.assign(result.drafts[0].href);
    if (result.sent || result.drafts.length) { setExtra(""); setTicks({}); }
  }

  async function saveTemplate() {
    const saved = await run("/api/dashboard/packages/email-template", { method: "PUT", body: { subject, body, package_title: pkg?.title ?? "" }, success: "Saved as the wording for new emails" });
    // The saved wording is now the template: stop treating it as typed over.
    if (saved) { setTypedSubject(null); setTypedBody(null); }
  }

  return <div className="space-y-4 text-sm">
    {packages.length !== 1 && <SelectField label="Package" name="package" value={packageId} onChange={setPackageId} placeholder="Choose a package"
      options={packages.map((item) => ({ value: item.id, label: `${item.title} (${item.talent} talent)` }))}
      hint={packages.length ? undefined : "There are no packages yet. Create one under Packages first."} />}
    {pkg && pkg.talent === 0 && <p className="rounded-md border border-[#ecd9b6] bg-[#fbf5e9] px-3 py-2 text-xs text-[#94692c]">This package has no talent yet. Add talent before emailing it.</p>}

    <fieldset>
      <legend className="text-[10px] font-800 uppercase tracking-[.14em] text-[#6f716b]">Send to</legend>
      {people.length > 0 && <ul className="mt-2 space-y-1.5">{people.map((person) => {
        const checked = ticks[person.key] ?? preselected.includes(person.key);
        return <li key={person.key}><label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-[#e7e7e3] bg-white px-3 py-2 hover:border-[#cfcfc8]">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#20211f]" checked={checked} onChange={(event) => setTicks((current) => ({ ...current, [person.key]: event.target.checked }))} />
          <span className="min-w-0"><span className="block font-700">{person.name}</span><span className="block break-all text-xs text-[#6b6d66]">{[person.detail, person.email].filter(Boolean).join(" · ")}</span></span>
        </label></li>;
      })}</ul>}
      <TextareaField label={people.length ? "More email addresses" : "Email addresses"} name="extra" className="mt-3" rows={2} value={extra} onChange={setExtra}
        hint={`Type or paste as many as you need (up to ${MAX_RECIPIENTS}), separated by commas, spaces or new lines.`} />
      <p className={`mt-2 text-xs ${typed.invalid.length ? "text-[#b3261e]" : "text-[#6b6d66]"}`} role="status">{typed.invalid.length
        ? `Check ${typed.invalid.length === 1 ? "this address" : "these addresses"}: ${typed.invalid.join(", ")}`
        : count ? `${count} ${count === 1 ? "person gets" : "people each get"} their own email and private link. Nobody sees the other addresses.` : "Nobody chosen yet."}</p>
    </fieldset>

    <TextField label="Subject" name="subject" value={subject} onChange={setTypedSubject} />
    <TextareaField label="Message" name="body" rows={7} value={body} onChange={setTypedBody}
      hint="Write it as you would to one person. The greeting with each person's name, their private link, the date it ends and your name are added for you. Press Preview to see the whole email." />
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="ghost" onClick={() => setPreviewUntil((current) => (current ? null : untilLabel(days)))}>{previewUntil ? "Hide preview" : "Preview"}</Button>
      <Button size="sm" variant="ghost" icon={<Save size={13} aria-hidden />} disabled={pending || !changed || !subject.trim() || !body.trim()} onClick={saveTemplate}>Save for next time</Button>
      <Button size="sm" variant="ghost" icon={<RotateCcw size={13} aria-hidden />} disabled={!changed} onClick={() => { setTypedSubject(null); setTypedBody(null); }}>Back to saved wording</Button>
    </div>
    {previewUntil && <div className="rounded-md border border-[#e7e7e3] bg-[#fafaf8] p-3" aria-label="Email preview">
      <p className="text-[10px] font-800 uppercase tracking-[.14em] text-[#6f716b]">What {firstName ?? "each person"} receives</p>
      <p className="mt-2 text-xs font-700">{composeSubject(subject) || "(no subject)"}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-[#3d3f3a]">{composeText({ firstName, body, link: "(their private link)", expires: previewUntil, sender: senderName, noReplyContact: mailReady ? contactEmail : null })}</p>
    </div>}

    <div className="flex flex-wrap items-end gap-2">
      <SelectField label="Link valid for" name="days" value={days} onChange={(value) => { setDays(value); setPreviewUntil((current) => (current ? untilLabel(value) : null)); }} options={DAYS} />
      <Button icon={<Mail size={14} aria-hidden />} disabled={pending || !pkg || pkg.talent === 0 || !subject.trim() || !body.trim()} onClick={send}>
        {pending ? "Sending…" : mailReady ? `Send email${count > 1 ? ` to ${count}` : ""}` : "Open in my email app"}
      </Button>
    </div>
    <p className="text-[11px] leading-5 text-[#6b6d66]">{mailReady
      ? `Sent from the agency's no-reply address. The email tells people to write to ${contactEmail}, and a reply goes there too.`
      : "This site is not connected to a mailbox yet, so the message opens in your own email app, ready to send. Each person still gets a private link of their own."}</p>

    {drafts.length > 0 && <div className="rounded-md border border-[#b7cdb9] bg-[#f3f8f3] p-3">
      <p className="text-xs font-700 text-[#3f6b45]">{drafts.length === 1 ? "Your email app should open with the message." : "Open each message in your email app and press send."} For security the links are not shown again.</p>
      <ul className="mt-2 space-y-1">{drafts.map((draft) => <li key={draft.to}><a href={draft.href} className="inline-flex items-center gap-1.5 text-xs font-700 underline underline-offset-2"><ExternalLink size={12} aria-hidden />Open the email to {draft.name ?? draft.to}</a></li>)}</ul>
    </div>}
  </div>;
}

const STATUS: Record<PackageEmailRow["status"], { label: string; tone: "public" | "draft" | "danger" | "review" }> = {
  sent: { label: "Sent", tone: "public" },
  manual: { label: "Email app", tone: "draft" },
  queued: { label: "Not sent", tone: "review" },
  failed: { label: "Failed", tone: "danger" },
};

// Who the package was emailed to, whether they opened it, and a way to stop one link.
export function PackageEmailLog({ packageId, emails, now }: { packageId: string; emails: PackageEmailRow[]; now: number }) {
  const { run, pending } = useMutation();
  if (!emails.length) return <p className="text-sm text-[#6b6d66]">Nobody has been emailed this package yet.</p>;
  return <ul className="divide-y divide-[#f3f3f0] text-sm">{emails.map((email) => {
    const expired = Date.parse(email.expires_at) < now;
    const live = !email.revoked_at && !expired;
    return <li key={email.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-700">{email.to_name ?? email.to_email}</p>
        <p className="break-all text-xs text-[#6b6d66]">{email.to_name ? `${email.to_email} · ` : ""}{formatDateTime(email.created_at)}</p>
        <p className="text-xs text-[#6b6d66]">{email.view_count ? `Opened ${email.view_count} time${email.view_count === 1 ? "" : "s"}${email.last_viewed_at ? `, last ${formatDateTime(email.last_viewed_at)}` : ""}` : "Not opened yet"}</p>
      </div>
      <Badge tone={STATUS[email.status].tone}>{STATUS[email.status].label}</Badge>
      {email.status !== "failed" && (email.revoked_at ? <Badge tone="internal">Link stopped</Badge> : expired ? <Badge tone="inactive">Link expired</Badge> : null)}
      {live && <Button size="sm" variant="ghost" disabled={pending} onClick={() => window.confirm(`Stop the link sent to ${email.to_name ?? email.to_email}?`) && run(`/api/dashboard/packages/${packageId}/email/${email.id}`, { method: "DELETE", success: "Link stopped" })}>Stop link</Button>}
    </li>;
  })}</ul>;
}
