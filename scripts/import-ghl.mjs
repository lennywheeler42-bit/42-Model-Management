// Imports existing GoHighLevel data into applications, through the same webhook
// the live GHL workflow uses (so mapping, de-duplication and photo handling are
// identical). Safe to re-run: one application per GHL contact.
//
// Dry run by default. See docs/ghl-integration.md for creating the token.
//
//   node --env-file=.env.local scripts/import-ghl.mjs                      # list what would be sent
//   node --env-file=.env.local scripts/import-ghl.mjs --apply              # send everything
//   node --env-file=.env.local scripts/import-ghl.mjs --source=contacts --tag=join-us --apply
//
// Environment:
//   GHL_API_TOKEN        Private Integration token (Settings → Private Integrations),
//                        scopes: contacts.readonly, forms.readonly, surveys.readonly, locations/customFields.readonly
//   GHL_LOCATION_ID      Sub-account (location) id
//   GHL_FORM_ID          Form or survey id of the registration form (for --source=forms / surveys)
//   GHL_WEBHOOK_SECRET   Same secret as the deployed site
//   IMPORT_TARGET_URL    e.g. https://42modelmanagement.com/api/integrations/ghl
const API = "https://services.leadconnectorhq.com";
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, "").split("=");
  return [key, value.length ? value.join("=") : true];
}));
const apply = Boolean(args.apply);
const source = args.source ?? (process.env.GHL_FORM_ID ? "forms" : "contacts");
const limit = args.limit ? Number(args.limit) : Infinity;

const required = ["GHL_API_TOKEN", "GHL_LOCATION_ID", ...(apply ? ["GHL_WEBHOOK_SECRET", "IMPORT_TARGET_URL"] : []), ...(source !== "contacts" ? ["GHL_FORM_ID"] : [])];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}
const { GHL_API_TOKEN, GHL_LOCATION_ID, GHL_FORM_ID, GHL_WEBHOOK_SECRET, IMPORT_TARGET_URL } = process.env;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ghl(path, params = {}) {
  const url = new URL(path, API);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${GHL_API_TOKEN}`, Version: "2021-07-28", Accept: "application/json" } });
    if (response.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    if (!response.ok) throw new Error(`GHL ${path} failed: ${response.status} ${(await response.text()).slice(0, 200)}`);
    return response.json();
  }
  throw new Error(`GHL ${path} kept rate-limiting`);
}

// id → label and fieldKey → label, so custom fields arrive under readable names.
async function fieldNames() {
  const names = {};
  const { customFields = [] } = await ghl(`/locations/${GHL_LOCATION_ID}/customFields`);
  for (const field of customFields) {
    names[field.id] = field.name;
    if (field.fieldKey) names[field.fieldKey] = field.name;
  }
  return names;
}

async function* submissions(kind) {
  for (let page = 1; ; page += 1) {
    const data = await ghl(`/${kind}/submissions`, { locationId: GHL_LOCATION_ID, [kind === "surveys" ? "surveyId" : "formId"]: GHL_FORM_ID, page, limit: 100 });
    const rows = data.submissions ?? [];
    for (const row of rows) {
      yield { contact_id: row.contactId, full_name: row.name, email: row.email, date_submitted: row.createdAt, ...(row.others ?? {}) };
    }
    if (!rows.length || !data.meta?.nextPage) return;
  }
}

async function* contacts(tag) {
  let startAfter; let startAfterId;
  for (;;) {
    const data = await ghl("/contacts/", { locationId: GHL_LOCATION_ID, limit: 100, startAfter, startAfterId });
    const rows = data.contacts ?? [];
    for (const contact of rows) {
      if (tag && !(contact.tags ?? []).map((item) => String(item).toLowerCase()).includes(String(tag).toLowerCase())) continue;
      yield {
        contact_id: contact.id, first_name: contact.firstName, last_name: contact.lastName, email: contact.email, phone: contact.phone,
        date_of_birth: contact.dateOfBirth, address1: contact.address1, city: contact.city, state: contact.state,
        postal_code: contact.postalCode, country: contact.country, tags: (contact.tags ?? []).join(", "),
        date_submitted: contact.dateAdded, customFields: contact.customFields ?? [],
      };
    }
    if (!rows.length || !data.meta?.startAfterId) return;
    ({ startAfter, startAfterId } = data.meta);
  }
}

const names = await fieldNames();
const stream = source === "contacts" ? contacts(args.tag) : submissions(source === "surveys" ? "surveys" : "forms");
const summary = { seen: 0, sent: 0, created: 0, updated: 0, failed: 0 };
console.log(`Source: ${source}${args.tag ? ` (tag ${args.tag})` : ""}. ${apply ? "Sending to " + IMPORT_TARGET_URL : "Dry run (pass --apply to send)."}`);

for await (const payload of stream) {
  if (summary.seen >= limit) break;
  summary.seen += 1;
  const who = payload.contact_id ?? payload.email ?? "(no id)";
  if (!apply) {
    const labels = Object.keys(payload).filter((key) => payload[key] !== undefined && payload[key] !== "" && key !== "customFields").map((key) => names[key] ?? key);
    console.log(`  - ${who}: ${labels.length} fields${payload.customFields?.length ? ` + ${payload.customFields.length} custom` : ""}`);
    continue;
  }
  try {
    const response = await fetch(IMPORT_TARGET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": GHL_WEBHOOK_SECRET },
      body: JSON.stringify({ ...payload, _fieldNames: names }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? `HTTP ${response.status}`);
    summary.sent += 1;
    summary[result.status === "created" ? "created" : "updated"] += 1;
    console.log(`  ✓ ${who} → ${result.status} (${result.photos ?? 0} photo(s))`);
  } catch (error) {
    summary.failed += 1;
    console.error(`  ✗ ${who}: ${error.message}`);
  }
  await sleep(250);
}

console.log(JSON.stringify(summary));
if (summary.failed) process.exit(1);
