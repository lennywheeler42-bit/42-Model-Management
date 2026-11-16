// Package emails: the editable template and how it becomes a message. Pure (no
// Next.js or Node imports), so the editor, the API route and the unit tests share it
// (tests/unit/package-email.test.mts).

export type EmailTemplate = { subject: string; body: string };

// What staff can put in a template. Each is filled in per recipient when sending.
export const PLACEHOLDERS = [
  { key: "contact_name", label: "the person's name" },
  { key: "company", label: "their company" },
  { key: "package_title", label: "the package title" },
  { key: "message", label: "the package's message to the client" },
  { key: "link", label: "their private link" },
  { key: "expires", label: "the date the link stops working" },
  { key: "sender_name", label: "your name" },
] as const;
export type PlaceholderKey = (typeof PLACEHOLDERS)[number]["key"];
export type TemplateValues = Record<PlaceholderKey, string>;

export const DEFAULT_TEMPLATE: EmailTemplate = {
  subject: "{{package_title}} from 42 Model Management",
  body: [
    "Hi {{contact_name}},",
    "",
    "Here is the selection we put together for you: {{package_title}}.",
    "",
    "{{message}}",
    "",
    "{{link}}",
    "",
    "The link is private and stays open until {{expires}}. Reply to this email to check availability or to ask for more options.",
    "",
    "{{sender_name}}",
    "42 Model Management",
  ].join("\n"),
};

export const SUBJECT_MAX = 200;
export const BODY_MAX = 6000;

const PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g;

// Fills the placeholders. Unknown ones are left as typed, so a typo is visible in the
// preview rather than silently dropped. Runs once: a value is never read as a template.
export function renderTemplate(text: string, values: TemplateValues) {
  return text.replace(PATTERN, (match, key: string) => (key in values ? values[key as PlaceholderKey] : match));
}

// A message must carry the link: without the placeholder it goes at the end.
export function withLink(body: string) {
  return /\{\{\s*link\s*\}\}/.test(body) ? body : `${body.trimEnd()}\n\n{{link}}`;
}

// Blank placeholders (no message, no company) leave empty paragraphs behind.
function tidy(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// A subject is one line: nothing typed into a name or title can add a header.
export function composeSubject(subject: string, values: TemplateValues) {
  return renderTemplate(subject, values).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 300);
}

export function composeText(body: string, values: TemplateValues) {
  return tidy(renderTemplate(withLink(body), values));
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The same message as simple HTML: escaped text, with the link as a button and the
// address spelled out under it for mail apps that block buttons.
export function composeHtml(body: string, values: TemplateValues) {
  const marker = "\u0000link\u0000";
  const text = tidy(renderTemplate(withLink(body), { ...values, link: marker }));
  const href = escapeHtml(values.link);
  const button = `<a href="${href}" style="display:inline-block;background:#181817;color:#ffffff;text-decoration:none;padding:12px 22px;font-size:13px;letter-spacing:.08em;text-transform:uppercase">View the package</a><br><span style="font-size:12px;color:#6b6d66">${href}</span>`;
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => `<p style="margin:0 0 16px">${escapeHtml(paragraph).replace(/\n/g, "<br>").split(marker).join(button)}</p>`);
  return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#181817;max-width:560px">${paragraphs.join("")}</div>`;
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

export function expiryLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
}
