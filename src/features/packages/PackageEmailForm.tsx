"use client";

import { useState } from "react";
import { ExternalLink, Mail, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SelectField, TextareaField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import { useMutation } from "@/lib/use-mutation";
import { PLACEHOLDERS, composeSubject, composeText, parseAddresses, type EmailTemplate, type TemplateValues } from "./email";
import type { PackageEmailRow, PackageOption, Person } from "./queries";

type Draft = { to: string; name: string | null; href: string };
type SendResult = { sent: number; failed: string[]; drafts: Draft[]; configured: boolean };

const DAYS = [{ value: "7", label: "7 days" }, { value: "14", label: "14 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }];

// Writes and sends the email for a package. Used on the package page (package fixed,
// people chosen from the client) and from Contacts and Companies (people fixed,
// package chosen). The subject and message start from the saved template and can be
// changed for this email, or saved as the template for the next ones.
export function PackageEmailForm({ packages, people, preselected = [], template, mailReady, senderName, before }: {
  packages: PackageOption[]; people: Person[]; preselected?: string[]; template: EmailTemplate; mailReady: boolean; senderName: string;
  // Runs before sending, e.g. to save the package; sending stops if it returns false.
  before?: () => Promise<boolean>;
}) {
  const toast = useToast();
  const { run, pending } = useMutation();
  const [packageId, setPackageId] = useState(packages.length === 1 ? packages[0].id : "");
  // Ticks the user changed; everyone else follows `preselected`.
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [extra, setExtra] = useState("");
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [days, setDays] = useState("30");
  const [preview, setPreview] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const chosen = people.filter((person) => ticks[person.key] ?? preselected.includes(person.key));
  const pkg = packages.find((item) => item.id === packageId) ?? null;
  const typed = parseAddresses(extra);
  const count = chosen.length + typed.valid.length;
  const changed = subject !== template.subject || body !== template.body;

  const sample: TemplateValues = {
    contact_name: chosen[0]?.name.split(/\s+/)[0] ?? "there", company: "", package_title: pkg?.title ?? "Package title", message: "",
    link: "[their private link]", expires: "[the date the link ends]", sender_name: senderName,
  };

  async function send() {
    if (!pkg) { toast.error("Choose a package first."); return; }
    if (typed.invalid.length) { toast.error(`Check ${typed.invalid.length === 1 ? "this address" : "these addresses"}: ${typed.invalid.join(", ")}`); return; }
    if (!count) { toast.error("Choose at least one person to email."); return; }
    if (before && !(await before())) return;
    const recipients = [
      ...chosen.map((person) => ({ contact_id: person.contact_id, email: person.email, name: person.name })),
      ...typed.valid.filter((email) => !chosen.some((person) => person.email.toLowerCase() === email.toLowerCase())).map((email) => ({ contact_id: null, email, name: "" })),
    ];
    const result = await run<SendResult>(`/api/dashboard/packages/${pkg.id}/email`, { body: { recipients, subject, body, days: Number(days) } });
    if (!result) return;
    if (result.failed.length) toast.error(`Could not be sent to ${result.failed.join(", ")}. Check the address and try again.`);
    if (result.sent) toast.success(`Email sent to ${result.sent} ${result.sent === 1 ? "person" : "people"}`);
    setDrafts(result.drafts);
    if (result.drafts.length === 1) window.location.assign(result.drafts[0].href);
    if (result.sent || result.drafts.length) { setExtra(""); setTicks({}); }
  }

  const saveTemplate = () => run("/api/dashboard/packages/email-template", { method: "PUT", body: { subject, body }, success: "Saved as the template for new emails" });

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
      <TextField label={people.length ? "Other addresses" : "Email addresses"} name="extra" className="mt-3" value={extra} onChange={setExtra} placeholder="name@company.com, another@company.com"
        hint={people.length ? "Optional. Separate several with commas." : "Separate several with commas. Add contacts with an email on the company's page to pick them here."} />
    </fieldset>

    <TextField label="Subject" name="subject" value={subject} onChange={setSubject} />
    <TextareaField label="Message" name="body" rows={11} value={body} onChange={setBody}
      hint={`Filled in for each person: ${PLACEHOLDERS.map((item) => `{{${item.key}}}`).join("  ")}`} />
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="ghost" onClick={() => setPreview((value) => !value)}>{preview ? "Hide preview" : "Preview"}</Button>
      <Button size="sm" variant="ghost" icon={<Save size={13} aria-hidden />} disabled={pending || !changed || !subject.trim() || !body.trim()} onClick={saveTemplate}>Save as template</Button>
      <Button size="sm" variant="ghost" icon={<RotateCcw size={13} aria-hidden />} disabled={!changed} onClick={() => { setSubject(template.subject); setBody(template.body); }}>Back to template</Button>
    </div>
    {preview && <div className="rounded-md border border-[#e7e7e3] bg-[#fafaf8] p-3">
      <p className="text-xs font-700">{composeSubject(subject, sample) || "(no subject)"}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-[#3d3f3a]">{composeText(body, sample)}</p>
    </div>}

    <div className="flex flex-wrap items-end gap-2">
      <SelectField label="Link valid for" name="days" value={days} onChange={setDays} options={DAYS} />
      <Button icon={<Mail size={14} aria-hidden />} disabled={pending || !pkg || pkg.talent === 0 || !subject.trim() || !body.trim()} onClick={send}>
        {pending ? "Sending…" : mailReady ? `Send email${count > 1 ? ` to ${count}` : ""}` : "Open in my email app"}
      </Button>
    </div>
    <p className="text-[11px] leading-5 text-[#6b6d66]">{mailReady
      ? "Each person gets a private link of their own. Replies come to your email address."
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
