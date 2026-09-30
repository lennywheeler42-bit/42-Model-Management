// Architecture guard rails that TypeScript cannot express. Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = join(import.meta.dirname, "..", "..");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}
const sources = files(join(root, "src")).map((path) => ({ path: relative(root, path).split(sep).join("/"), text: readFileSync(path, "utf8") }));

// The service-role client bypasses RLS: only integrations without a user session may use it.
const ADMIN_ALLOWED = ["src/app/api/integrations/ghl/route.ts"];

test("only allow-listed server integrations import the admin (service-role) client", () => {
  const importers = sources.filter((file) => /from\s+["']@\/lib\/supabase\/admin["']/.test(file.text)).map((file) => file.path);
  assert.deepEqual(importers.sort(), ADMIN_ALLOWED.sort());
});

test("no client component imports server-only modules", () => {
  const offenders = sources.filter((file) => /^\s*["']use client["']/m.test(file.text)
    && /from\s+["'](@\/lib\/supabase\/(admin|server)|@\/lib\/agency-auth|@\/features\/applications\/ingest|@\/features\/portal\/context|@\/features\/compcard\/build|@\/features\/packages\/share|next\/headers)["']/.test(file.text));
  assert.deepEqual(offenders.map((file) => file.path), []);
});

test("the secret key is read only by the admin client", () => {
  const readers = sources.filter((file) => /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/.test(file.text)).map((file) => file.path);
  assert.deepEqual(readers, ["src/lib/supabase/admin.ts"]);
});

test("no NEXT_PUBLIC_ variable carries a secret", () => {
  const leaks = sources.filter((file) => /NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE|TOKEN|PASSWORD)/.test(file.text)).map((file) => file.path);
  assert.deepEqual(leaks, []);
});
