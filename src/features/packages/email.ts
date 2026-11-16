// Package emails: what staff write and how it becomes a message. Pure (no Next.js or
// Node imports), so the form, the API route and the unit tests share it
// (tests/unit/package-email.test.mts).
//
// Staff write a subject and a message in plain words. Everything that differs per
// person is added for them: the greeting with the person's first name, their private
// link, the date it ends, the sender's name and, when the site sends the email itself,
// a note that the address is not read and where to write instead.

export type EmailTemplate = { subject: string; body: string };

// The one thing a saved template fills in by itself: the package's title in the
// subject. Staff never see this marker. The form shows the title written out
// (subjectFor) and puts the marker back when the wording is saved (subjectToTemplate).
const TITLE_MARKER = "{{package_title}}";
const ANY_MARKER = /\{\{\s*[a-z_]+\s*\}\}/g;
const NO_TITLE = "Talent selection";

export const DEFAULT_TEMPLATE: EmailTemplate = {
  subject: `${TITLE_MARKER} from 42 Model Management`,
  body: "Here is the selection we put together for you. Open the link below to see everyone's photos and details.\n\nLet us know who you would like to book, or if you would like to see more options.",
};

export const SUBJECT_MAX = 200;
export const BODY_MAX = 6000;

const oneLine = (value: string) => value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();

// The subject as staff see and edit it: the template with this package's title in it.
export function subjectFor(templateSubject: string, packageTitle: string | null | undefined) {
  const title = oneLine(packageTitle ?? "") || NO_TITLE;
  // Split and join: a title is text, never a pattern, and is not read again.
  return oneLine(templateSubject.split(TITLE_MARKER).join(title).replace(ANY_MARKER, ""));
}

// The subject as it is saved for next time: where staff left this package's title,
// the next package's title goes.
export function subjectToTemplate(subject: string, packageTitle: string | null | undefined) {
  const title = oneLine(packageTitle ?? "");
  const text = oneLine(subject.replace(ANY_MARKER, ""));
  const at = title ? text.indexOf(title) : -1;
  return at < 0 ? text : `${text.slice(0, at)}${TITLE_MARKER}${text.slice(at + title.length)}`;
}

// A saved message as staff see it: plain words only. Markers from an older template
// are dropped, with the line they stood alone on.
export function plainBody(body: string) {
  return body.replace(/\r\n/g, "\n").split("\n").filter((line) => !(line.trim() && !line.replace(ANY_MARKER, "").trim())).join("\n")
    .replace(ANY_MARKER, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// A subject is one line: nothing typed into it can add a header.
export function composeSubject(subject: string) {
  return oneLine(subject.replace(ANY_MARKER, "")).slice(0, 300);
}

export type MessageParts = {
  // The person's first name, if known.
  firstName: string | null;
  // What staff wrote.
  body: string;
  // The person's private link and the day it stops working, written out.
  link: string;
  expires: string;
  // Who is writing.
  sender: string;
  // Set when the site sends the email itself, from an address nobody reads: the
  // address to write to instead. Left out when staff send from their own mailbox.
  noReplyContact: string | null;
};

const greeting = (firstName: string | null) => (firstName ? `Hi ${firstName},` : "Hello,");
const expiryLine = (expires: string) => `This link is private and stays open until ${expires}.`;
const signOff = (sender: string) => (sender && sender !== "42 Model Management" ? [sender, "42 Model Management"] : ["42 Model Management"]);
export const noReplyNote = (contact: string) =>
  `Please do not reply to this email. It was sent from a no-reply address used for automated messages, so replies are not read. To get in touch, kindly email ${contact}.`;

export function composeText(parts: MessageParts) {
  return [
    greeting(parts.firstName),
    plainBody(parts.body),
    `View the package: ${parts.link}`,
    expiryLine(parts.expires),
    signOff(parts.sender).join("\n"),
    ...(parts.noReplyContact ? [noReplyNote(parts.noReplyContact)] : []),
  ].filter(Boolean).join("\n\n");
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const paragraph = (text: string, style = "margin:0 0 16px") => `<p style="${style}">${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;

// The same message as simple HTML: escaped text, the link as a button with the
// address spelled out under it for mail apps that block buttons.
export function composeHtml(parts: MessageParts) {
  const href = escapeHtml(parts.link);
  const contact = parts.noReplyContact ? escapeHtml(parts.noReplyContact) : null;
  return [
    '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#181817;max-width:560px">',
    paragraph(greeting(parts.firstName)),
    ...plainBody(parts.body).split(/\n{2,}/).filter(Boolean).map((text) => paragraph(text)),
    `<p style="margin:24px 0 8px"><a href="${href}" style="display:inline-block;background:#181817;color:#ffffff;text-decoration:none;padding:12px 22px;font-size:13px;letter-spacing:.08em;text-transform:uppercase">View the package</a></p>`,
    `<p style="margin:0 0 16px;font-size:12px;color:#6b6d66">${href}<br>${escapeHtml(expiryLine(parts.expires))}</p>`,
    paragraph(signOff(parts.sender).join("\n")),
    ...(contact ? [`<p style="margin:24px 0 0;padding-top:14px;border-top:1px solid #e7e7e3;font-size:12px;color:#6b6d66">Please do not reply to this email. It was sent from a no-reply address used for automated messages, so replies are not read. To get in touch, kindly email <a href="mailto:${contact}" style="color:#181817">${contact}</a>.</p>`] : []),
    "</div>",
  ].join("");
}

// For "open in my email app" when the site cannot send: a mailto link with the message.
export function mailtoHref(to: string, subject: string, text: string) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

// Addresses typed by hand, separated by commas, semicolons, spaces or new lines.
export function parseAddresses(input: string) {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const part of input.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean)) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    (isEmail(part) ? valid : invalid).push(part);
  }
  return { valid, invalid };
}

export function isEmail(value: string) {
  return value.length <= 200 && /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:".]{2,}$/.test(value);
}

export const MAX_RECIPIENTS = 20;

export function expiryLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
}
