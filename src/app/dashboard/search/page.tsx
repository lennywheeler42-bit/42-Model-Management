import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { Card, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, UnauthorizedState } from "@/components/ui/States";
import { requirePage } from "@/lib/agency-auth";

export const metadata = { title: "Search" };

// Global search shell. Covers talent and boards today; companies, clients,
// contacts, bookings, documents, and applications join as their phases land.
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const context = await requirePage("talent.view");
  if (!context) return <UnauthorizedState />;
  const q = ((await searchParams).q ?? "").replace(/[,()%*\\]/g, " ").trim().slice(0, 80);

  const header = <PageHeader eyebrow="Workspace" title="Search" description="Talent and boards. More record types are added as their modules arrive." />;
  const form = <form role="search" className="flex gap-2"><label htmlFor="search-q" className="sr-only">Search</label>
    <input id="search-q" name="q" defaultValue={q} autoFocus placeholder="Name, talent ID, location, or board" className="w-full max-w-xl rounded-md border border-[#dcdcd6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#c26a48]" />
    <button className="rounded-md bg-[#20211f] px-4 text-[10px] font-800 uppercase tracking-[.12em] text-white">Search</button></form>;
  if (!q) return <div className="space-y-6">{header}{form}<EmptyState title="Type to search the workspace" /></div>;

  const [talent, boards] = await Promise.all([
    context.supabase.from("talent").select("id,display_name,talent_id,location,publication_status")
      .or(`display_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,talent_id.ilike.%${q}%,location.ilike.%${q}%`)
      .order("display_name").limit(25),
    context.permissions.has("boards.view")
      ? context.supabase.from("boards").select("id,name,slug,is_active").or(`name.ilike.%${q}%,slug.ilike.%${q}%`).order("name").limit(10)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (talent.error || boards.error) return <div className="space-y-6">{header}{form}<ErrorState title="Search failed" /></div>;

  return <div className="space-y-6">
    {header}{form}
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Card title={`Talent (${talent.data.length})`}>
        {talent.data.length ? <ul className="divide-y divide-[#f3f3f0] text-sm">{talent.data.map((row) => <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
          <Link href={`/dashboard/talent/${row.id}`} className="hover:text-[#c26a48]"><span className="font-700">{row.display_name}</span><span className="block text-[11px] text-[#8d8f88]">{[row.talent_id, row.location].filter(Boolean).join(" · ")}</span></Link>
          <StatusBadge status={row.publication_status} />
        </li>)}</ul> : <p className="text-xs text-[#a2a39d]">No talent matches “{q}”.</p>}
      </Card>
      {context.permissions.has("boards.view") && <Card title={`Boards (${boards.data?.length ?? 0})`}>
        {boards.data?.length ? <ul className="space-y-2 text-sm">{boards.data.map((board) => <li key={board.id}><Link href={`/dashboard/talent?board=${board.id}`} className="hover:text-[#c26a48]">{board.name}</Link>{!board.is_active && <span className="ml-2 text-[11px] text-[#a2a39d]">inactive</span>}</li>)}</ul> : <p className="text-xs text-[#a2a39d]">No boards match.</p>}
      </Card>}
    </div>
  </div>;
}
