// Package emails: the template and how it becomes a message. Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TEMPLATE, PLACEHOLDERS, composeHtml, composeSubject, composeText, isEmail, mailtoHref, parseAddresses, renderTemplate, withLink,
  type TemplateValues,
} from "../../src/features/packages/email.ts";
import { companyPeople } from "../../src/features/packages/queries.ts";

const values: TemplateValues = {
  contact_name: "Casey", company: "Acme Studio", package_title: "Spring campaign", message: "Two options for the shoot.",
  link: "https://example.test/p/abc123", expires: "December 17, 2026", sender_name: "Lenny",
};

test("every placeholder in the built-in template is one staff are told about", () => {
  const known = new Set<string>(PLACEHOLDERS.map((item) => item.key));
  for (const text of [DEFAULT_TEMPLATE.subject, DEFAULT_TEMPLATE.body]) {
    for (const match of text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) assert.ok(known.has(match[1]), match[1]);
  }
});

test("placeholders are filled once; unknown ones stay visible", () => {
  assert.equal(renderTemplate("Hi {{ contact_name }} at {{company}}, {{nope}}", values), "Hi Casey at Acme Studio, {{nope}}");
  // A value that looks like a placeholder is not expanded again.
  assert.equal(renderTemplate("{{message}}", { ...values, message: "{{link}}" }), "{{link}}");
});

test("the built-in template makes a complete message", () => {
  assert.equal(composeSubject(DEFAULT_TEMPLATE.subject, values), "Spring campaign from 42 Model Management");
  const text = composeText(DEFAULT_TEMPLATE.body, values);
  assert.ok(text.startsWith("Hi Casey,"));
  assert.ok(text.includes("https://example.test/p/abc123"));
  assert.ok(text.includes("December 17, 2026"));
  assert.ok(!/\{\{/.test(text));
});

test("a message always carries the link", () => {
  assert.equal(withLink("Hello"), "Hello\n\n{{link}}");
  assert.equal(withLink("See {{ link }} now"), "See {{ link }} now");
  assert.ok(composeText("Hello {{contact_name}}", values).endsWith("https://example.test/p/abc123"));
});

test("blank values leave no empty paragraphs", () => {
  const text = composeText("Hi {{contact_name}},\n\n{{message}}\n\n{{company}}\n\n{{link}}", { ...values, message: "", company: "" });
  assert.equal(text, "Hi Casey,\n\nhttps://example.test/p/abc123");
});

test("a subject is one line, whatever a name or title holds", () => {
  const subject = composeSubject("{{package_title}} for {{contact_name}}", { ...values, package_title: "Spring\r\nBcc: someone@evil.test", contact_name: "Casey\tX" });
  assert.ok(!/[\r\n\t]/.test(subject));
  assert.equal(subject, "Spring Bcc: someone@evil.test for Casey X");
});

test("the HTML version escapes what staff typed and links only to the package", () => {
  const html = composeHtml("Hi {{contact_name}} <b>bold</b>\n\n{{link}}", { ...values, contact_name: "<script>alert(1)</script>", link: "https://example.test/p/a\"b" });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;b&gt;bold&lt;/b&gt;"));
  assert.equal([...html.matchAll(/href="([^"]*)"/g)].length, 1);
  assert.ok(html.includes('href="https://example.test/p/a&quot;b"'));
});

test("addresses typed by hand are split, de-duplicated and checked", () => {
  const result = parseAddresses("a@x.test, B@x.test; a@X.test\nnot-an-email  c@x");
  assert.deepEqual(result.valid, ["a@x.test", "B@x.test"]);
  assert.deepEqual(result.invalid, ["not-an-email", "c@x"]);
  assert.deepEqual(parseAddresses("  "), { valid: [], invalid: [] });
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
