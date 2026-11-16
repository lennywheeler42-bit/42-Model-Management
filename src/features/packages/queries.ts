import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TEMPLATE, type EmailTemplate } from "./email.ts";

// Reads for the package screens, always as the signed-in user (RLS applies).

export const PACKAGE_TEMPLATE_KEY = "package";

// The saved package email template, or the built-in one until staff save their own.
export async function packageTemplate(supabase: SupabaseClient): Promise<EmailTemplate> {
  const { data } = await supabase.from("email_templates").select("subject,body").eq("key", PACKAGE_TEMPLATE_KEY).maybeSingle();
  return data ? { subject: data.subject as string, body: data.body as string } : DEFAULT_TEMPLATE;
}

export type PackageEmailRow = {
  id: string; to_email: string; to_name: string | null; subject: string; status: "queued" | "sent" | "manual" | "failed";
  expires_at: string; revoked_at: string | null; view_count: number; last_viewed_at: string | null; created_at: string;
};

// The token hash is never selected: the page has no use for it.
const EMAIL_COLUMNS = "id,to_email,to_name,subject,status,expires_at,revoked_at,view_count,last_viewed_at,created_at";

export async function packageEmails(supabase: SupabaseClient, packageId: string) {
  const { data, error } = await supabase.from("package_emails").select(EMAIL_COLUMNS).eq("package_id", packageId).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as PackageEmailRow[];
}

export type PackageOption = { id: string; title: string; talent: number };

// Packages that can be emailed, newest first.
export async function packageOptions(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("packages").select("id,title,package_items(count)").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return ((data ?? []) as unknown as { id: string; title: string; package_items: { count: number }[] }[]).map((row) => ({ id: row.id, title: row.title, talent: row.package_items[0]?.count ?? 0 })) as PackageOption[];
}

export type Person = { key: string; contact_id: string | null; name: string; email: string; detail?: string };

// People at a company who can be emailed: its contacts with an address, then the
// company's own address.
export function companyPeople(company: { id: string; name: string; email: string | null } | null, contacts: { id: string; name: string; email: string | null; title?: string | null; is_primary?: boolean }[]): Person[] {
  const people: Person[] = contacts.filter((contact) => contact.email).map((contact) => ({ key: contact.id, contact_id: contact.id, name: contact.name, email: contact.email as string, detail: contact.title ?? undefined }));
  if (company?.email && !people.some((person) => person.email.toLowerCase() === company.email!.toLowerCase())) people.push({ key: `company:${company.id}`, contact_id: null, name: company.name, email: company.email, detail: "Company address" });
  return people;
}
