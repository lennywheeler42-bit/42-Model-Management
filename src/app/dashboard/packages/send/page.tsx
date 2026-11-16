import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, UnauthorizedState } from "@/components/ui/States";
import { requirePage } from "@/lib/agency-auth";
import { log } from "@/lib/log";
import { mailerConfigured } from "@/lib/mailer";
import { getSiteSettings } from "@/features/cms/queries";
import { PackageEmailForm } from "@/features/packages/PackageEmailForm";
import { companyPeople, packageOptions, packageTemplate } from "@/features/packages/queries";

export const metadata = { title: "Email a package" };

const isId = (value: string | undefined): value is string => Boolean(value && /^[0-9a-f-]{36}$/i.test(value));
const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] ?? null : value ?? null);
type Company = { id: string; name: string; email: string | null };

// Email a package to a contact or to a company's contacts: opened from Contacts and
// Companies with ?contact=<id> or ?company=<id>.
export default async function SendPackagePage({ searchParams }: { searchParams: Promise<{ contact?: string; company?: string }> }) {
  const context = await requirePage("packages.manage");
  if (!context) return <UnauthorizedState />;
  const { supabase } = context;
  const search = await searchParams;

  let company: Company | null = null;
  let contacts: { id: string; name: string; email: string | null; title: string | null; is_primary: boolean }[] = [];
  let preselected: string[] = [];
  let packages: Awaited<ReturnType<typeof packageOptions>>;
  let template: Awaited<ReturnType<typeof packageTemplate>>;
  try {
    let companyId = isId(search.company) ? search.company : null;
    if (isId(search.contact)) {
      const { data } = await supabase.from("company_contacts").select("id,company:company_id(id,name,email)").eq("id", search.contact).maybeSingle();
      if (data) {
        company = one(data.company as Company | Company[] | null);
        companyId = company?.id ?? null;
        preselected = [data.id as string];
      }
    }
    if (companyId) {
      const [companyRow, contactRows] = await Promise.all([
        company ? Promise.resolve({ data: company }) : supabase.from("companies").select("id,name,email").eq("id", companyId).maybeSingle(),
        supabase.from("company_contacts").select("id,name,email,title,is_primary").eq("company_id", companyId).order("is_primary", { ascending: false }).order("name"),
      ]);
      company = (companyRow.data as Company | null) ?? null;
      contacts = (contactRows.data ?? []) as typeof contacts;
      // From a company: its primary contact is ticked to start with.
      if (!preselected.length) preselected = contacts.filter((contact) => contact.is_primary && contact.email).map((contact) => contact.id);
    }
    [packages, template] = await Promise.all([packageOptions(supabase), packageTemplate(supabase)]);
  } catch (error) {
    log.error("packages", "send page failed", error);
    return <ErrorState title="This page could not be loaded" />;
  }
  const people = companyPeople(company, contacts);
  const settings = await getSiteSettings();
  const back = company ? { href: `/dashboard/companies/${company.id}`, label: company.name } : { href: "/dashboard/contacts", label: "Contacts" };

  return <div className="space-y-6">
    <Link href={back.href} className="inline-flex items-center gap-2 text-xs text-[#6b6d66] hover:text-[#20211f]"><ArrowLeft size={14} aria-hidden />{back.label}</Link>
    <PageHeader eyebrow="Packages" title="Email a package" description={company ? `Send ${company.name} a package with a private link.` : "Send a package with a private link."} />
    <Card className="max-w-2xl" title="Email" description="Choose a package and who gets it: one person or several. Each gets an email and a private link of their own.">
      <PackageEmailForm packages={packages} people={people} preselected={preselected} template={template} mailReady={mailerConfigured()} senderName={context.membership.full_name || "42 Model Management"} contactEmail={settings.contact_email} />
      <p className="mt-5 border-t border-[#efefeb] pt-4 text-xs text-[#6b6d66]">Need a new selection first? <Link href="/dashboard/packages" className="font-700 underline underline-offset-2">Create a package</Link>, add talent, then email it from the package page.</p>
    </Card>
  </div>;
}
