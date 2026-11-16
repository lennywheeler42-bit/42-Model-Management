// Package emails: what staff write and how it becomes a message. Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TEMPLATE, MAX_RECIPIENTS, composeHtml, composeSubject, composeText, isEmail, mailtoHref, noReplyNote, parseAddresses, plainBody,
  subjectFor, subjectToTemplate, type MessageParts,
} from "../../src/features/packages/email.ts";
import { companyPeople } from "../../src/features/packages/queries.ts";

const parts: MessageParts = {
  firstName: "Casey", body: "Two options for the shoot.\n\nBoth are free that week.", link: "https://example.test/p/abc123",
  expires: "December 17, 2026", sender: "Lenny", noReplyContact: "lenny@example.test",
};
const BRACES = /[{}]/;

test("staff never see a curly bracket: not in the subject, the message or the email", () => {
  const subject = subjectFor(DEFAULT_TEMPLATE.subject, "Spring campaign");
  assert.equal(subject, "Spring campaign from 42 Model Management");
  assert.ok(!BRACES.test(subject));
  assert.ok(!BRACES.test(plainBody(DEFAULT_TEMPLATE.body)));
  assert.ok(!BRACES.test(composeText({ ...parts, body: DEFAULT_TEMPLATE.body })));
  assert.ok(!BRACES.test(composeHtml({ ...parts, body: DEFAULT_TEMPLATE.body })));
  // Before a package is chosen the subject still reads as a sentence.
  assert.equal(subjectFor(DEFAULT_TEMPLATE.subject, ""), "Talent selection from 42 Model Management");
});

test("saved wording follows the next package's title", () => {
  const saved = subjectToTemplate("New faces: Spring campaign, from 42", "Spring campaign");
  assert.equal(subjectFor(saved, "Summer lookbook"), "New faces: Summer lookbook, from 42");
  // A subject that does not name the package is kept word for word.
  assert.equal(subjectFor(subjectToTemplate("A selection for you", "Spring campaign"), "Summer lookbook"), "A selection for you");
  // A title is text, never a pattern; a marker typed into a title is dropped, not filled in.
  assert.equal(subjectFor(DEFAULT_TEMPLATE.subject, "$& {{package_title}} (a+)"), "$& (a+) from 42 Model Management");
});

test("an older template with markers is shown as plain words", () => {
  const old = "Hi {{contact_name}},\n\nHere is the selection: {{package_title}}.\n\n{{message}}\n\n{{link}}\n\nOpen until {{expires}}.\n\n{{sender_name}}";
  assert.equal(plainBody(old), "Hi ,\n\nHere is the selection: .\n\nOpen until .");
  assert.ok(!BRACES.test(subjectFor("{{package_title}} for {{contact_name}}", "Spring")));
});

test("the email is put together around what staff wrote", () => {
  assert.equal(composeText(parts), [
    "Hi Casey,",
    "Two options for the shoot.\n\nBoth are free that week.",
    "View the package: https://example.test/p/abc123",
    "This link is private and stays open until December 17, 2026.",
    "Lenny\n42 Model Management",
    "Please do not reply to this email. It was sent from a no-reply address used for automated messages, so replies are not read. To get in touch, kindly email lenny@example.test.",
  ].join("\n\n"));
});

test("without a name the greeting is general; without a sender the agency signs", () => {
  const text = composeText({ ...parts, firstName: null, sender: "42 Model Management" });
  assert.ok(text.startsWith("Hello,\n\n"));
  assert.ok(text.includes("\n\n42 Model Management\n\nPlease do not reply"));
  assert.ok(!text.includes("42 Model Management\n42 Model Management"));
});

test("the no-reply note names where to write, and is left out when staff send from their own mailbox", () => {
  assert.ok(noReplyNote("lenny@example.test").includes("kindly email lenny@example.test"));
  assert.ok(composeText(parts).endsWith(noReplyNote("lenny@example.test")));
  const own = composeText({ ...parts, noReplyContact: null });
  assert.ok(!/no-reply|do not reply/i.test(own));
  assert.ok(own.endsWith("Lenny\n42 Model Management"));
  assert.ok(!/no-reply/i.test(composeHtml({ ...parts, noReplyContact: null })));
});

test("a subject is one line, whatever is typed into it", () => {
  const subject = composeSubject("Spring\r\nBcc: someone@evil.test\tX");
  assert.ok(!/[\r\n\t]/.test(subject));
  assert.equal(subject, "Spring Bcc: someone@evil.test X");
  assert.equal(composeSubject("  "), "");
});

test("the HTML version escapes what staff typed and links only to the package and the contact address", () => {
  const html = composeHtml({ ...parts, firstName: "<script>alert(1)</script>", body: "See <b>bold</b>", link: "https://example.test/p/a\"b", sender: "A & B" });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;b&gt;bold&lt;/b&gt;"));
  assert.ok(html.includes("A &amp; B"));
  assert.deepEqual([...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]), ["https://example.test/p/a&quot;b", "mailto:lenny@example.test"]);
});

test("several addresses typed or pasted at once are split, de-duplicated and checked", () => {
  const result = parseAddresses("a@x.test, B@x.test; a@X.test\nnot-an-email  c@x\nd@y.test e@z.test");
  assert.deepEqual(result.valid, ["a@x.test", "B@x.test", "d@y.test", "e@z.test"]);
  assert.deepEqual(result.invalid, ["not-an-email", "c@x"]);
  assert.deepEqual(parseAddresses("  "), { valid: [], invalid: [] });
  const many = parseAddresses(Array.from({ length: MAX_RECIPIENTS }, (_, index) => `person${index}@x.test`).join(", "));
  assert.equal(many.valid.length, MAX_RECIPIENTS);
});

test("an address cannot smuggle a second recipient or a header", () => {
  for (const bad of ["a@x.test,b@x.test", "a@x.test\nBcc:b@x.test", "Name <a@x.test>", "a b@x.test", "a@x", "@x.test", `${"a".repeat(200)}@x.test`]) assert.ok(!isEmail(bad), bad);
  for (const good of ["casey@acme.test", "first.last+tag@sub.example.co.uk"]) assert.ok(isEmail(good), good);
});

test("the email-app link carries the address, subject and message", () => {
  const href = mailtoHref("casey@acme.test", "Spring & summer", "Line one\nLine two");
  assert.equal(href, "mailto:casey%40acme.test?subject=Spring%20%26%20summer&body=Line%20one%0ALine%20two");
});

test("people at a company: contacts with an address, then the company's own", () => {
  const company = { id: "c1", name: "Acme Studio", email: "hello@acme.test" };
  const people = companyPeople(company, [
    { id: "p1", name: "Casey", email: "casey@acme.test", title: "Producer" },
    { id: "p2", name: "No Address", email: null },
  ]);
  assert.deepEqual(people.map((person) => [person.key, person.email, person.contact_id]), [["p1", "casey@acme.test", "p1"], ["company:c1", "hello@acme.test", null]]);
  // The company's address is not listed twice when a contact already uses it.
  assert.equal(companyPeople(company, [{ id: "p1", name: "Casey", email: "HELLO@acme.test" }]).length, 1);
  assert.deepEqual(companyPeople(null, []), []);
});
