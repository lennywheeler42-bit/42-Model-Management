import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, UnauthorizedState } from "@/components/ui/States";
import { displayNameForUser, requirePage } from "@/lib/agency-auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { loadOverview } from "@/features/dashboard/overview";

export const metadata = { title: "Dashboard" };

type Ref = { id: string; display_name: string } | null;
const one = (value: unknown) => (Array.isArray(value) ? value[0] : value) as Ref;

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[#a2a39d]">{children}</p>;
}

function TalentLink({ talent }: { talent: Ref }) {
  return talent ? <Link href={`/dashboard/talent/${talent.id}`} className="font-700 hover:text-[#c26a48]">{talent.display_name}</Link> : <span>—</span>;
}

export default async function DashboardHome() {
  const context = await requirePage("dashboard.access");
  if (!context) return <UnauthorizedState />;
  const { permissions } = context;

  let data: Awaited<ReturnType<typeof loadOverview>>;
  try {
    data = await loadOverview(context.supabase, permissions);
  } catch (error) {
    console.error("[dashboard] overview failed", error);
    return <ErrorState title="The dashboard could not be loaded" />;
  }

  const name = displayNameForUser(context.user, context.profile).split(" ")[0];
  return <div className="space-y-8">
    <PageHeader eyebrow="Agency OS" title={`Welcome back, ${name}.`} description="Live figures from the talent database. Sections appear according to your role."
      actions={permissions.has("talent.create") ? <ButtonLink href="/dashboard/talent/new" icon={<Plus size={14} />}>New talent</ButtonLink> : null} />

    {data.metrics && <section aria-label="Talent totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[
        ["Active talent", data.metrics.active, "/dashboard/talent"],
        ["Live on website", data.metrics.live, "/dashboard/talent?status=website"],
        ["In review", data.metrics.inReview, "/dashboard/talent?status=review"],
        ["Drafts", data.metrics.drafts, "/dashboard/talent?status=draft"],
      ].map(([label, value, href]) => <Link key={label as string} href={href as string} className="rounded-xl border border-[#e7e7e3] bg-white p-5 transition-colors hover:border-[#20211f]">
        <p className="text-[10px] font-800 uppercase tracking-[.14em] text-[#8d8f88]">{label}</p>
        <p className="mt-3 text-4xl font-700 tracking-[-.04em]">{value}</p>
      </Link>)}
    </section>}

    <div className="grid gap-6 lg:grid-cols-2">
      {permissions.has("talent.view") && <Card title="Pending review" description="Talent waiting for a publishing decision.">
        {data.review.length ? <ul className="space-y-3 text-sm">{data.review.map((talent) => <li key={talent.id} className="flex justify-between gap-3"><TalentLink talent={talent} /><span className="text-xs text-[#8d8f88]">{formatDate(talent.updated_at)}</span></li>)}</ul> : <Empty>Nothing is waiting for review.</Empty>}
      </Card>}

      {permissions.has("talent.view") && <Card title="Recently updated">
        {data.recent.length ? <ul className="space-y-3 text-sm">{data.recent.map((talent) => <li key={talent.id} className="flex items-center justify-between gap-3"><TalentLink talent={talent} /><span className="flex items-center gap-3"><StatusBadge status={talent.publication_status} /><span className="text-xs text-[#8d8f88]">{formatDate(talent.updated_at)}</span></span></li>)}</ul> : <Empty>No talent records yet.</Empty>}
      </Card>}

      {permissions.has("operations.view") && <Card title="Upcoming appointments" description="Next 14 days.">
        {data.appointments.length ? <ul className="space-y-3 text-sm">{data.appointments.map((item) => <li key={item.id} className="flex justify-between gap-3"><span><TalentLink talent={one(item.talent)} /><span className="block text-xs text-[#8d8f88]">{[item.event_type, item.client].filter(Boolean).join(" · ") || "Appointment"}</span></span><span className="text-right text-xs text-[#8d8f88]">{formatDateTime(item.start_at)}</span></li>)}</ul> : <Empty>No appointments in the next two weeks.</Empty>}
      </Card>}

      {permissions.has("legal.view") && <Card title="Contracts, passports, visas & permits" description="Expired or expiring within 60 days.">
        {data.expiring.length ? <ul className="space-y-3 text-sm">{data.expiring.map((item, index) => <li key={`${item.talent?.id}-${item.label}-${index}`} className="flex justify-between gap-3"><span><TalentLink talent={item.talent} /><span className="block text-xs text-[#8d8f88]">{item.label}</span></span><span className="flex items-center gap-2 text-xs">{item.expired && <Badge tone="internal">Expired</Badge>}{formatDate(item.date)}</span></li>)}</ul> : <Empty>Nothing expires in the next 60 days.</Empty>}
      </Card>}

      {permissions.has("talent.private.view") && <Card title="Upcoming birthdays" description="Next 30 days.">
        {data.birthdays.length ? <ul className="space-y-3 text-sm">{data.birthdays.map((item) => <li key={item.talent?.id} className="flex justify-between gap-3"><TalentLink talent={item.talent} /><span className="text-xs text-[#8d8f88]">{item.days === 0 ? "Today" : formatDate(item.date, { month: "short", day: "numeric" })}</span></li>)}</ul> : <Empty>No birthdays in the next 30 days.</Empty>}
      </Card>}

      {permissions.has("media.view") && <Card title="Recent uploads">
        {data.uploads.length ? <ul className="space-y-3 text-sm">{data.uploads.map((photo) => <li key={photo.id} className="flex justify-between gap-3"><span><TalentLink talent={one(photo.talent)} /><span className="block truncate text-xs text-[#8d8f88]">{photo.title || "Untitled image"}</span></span><span className="text-xs text-[#8d8f88]">{formatDate(photo.created_at)}</span></li>)}</ul> : <Empty>No media uploaded yet.</Empty>}
      </Card>}

      {permissions.has("audit.view") && <Card title="Recent activity" className="lg:col-span-2" actions={<Link href="/dashboard/settings?section=activity" className="text-[10px] font-800 uppercase tracking-[.14em] text-[#8d8f88] hover:text-[#20211f]">View all</Link>}>
        {data.activity.length ? <ul className="divide-y divide-[#f3f3f0] text-xs">{data.activity.map((event) => {
          const actor = (Array.isArray(event.actor) ? event.actor[0] : event.actor) as { full_name: string; email: string } | null;
          return <li key={event.id} className="flex flex-wrap justify-between gap-2 py-2.5"><span><span className="font-700">{actor?.full_name || actor?.email || "System"}</span> <span className="text-[#6f716b]">{event.action.replaceAll("_", " ")}</span></span><span className="text-[#8d8f88]">{formatDateTime(event.created_at)}</span></li>;
        })}</ul> : <Empty>No activity recorded yet.</Empty>}
      </Card>}
    </div>
  </div>;
}
