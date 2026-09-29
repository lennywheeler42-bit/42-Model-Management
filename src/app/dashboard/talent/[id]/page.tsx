import Link from "next/link";
import { notFound } from "next/navigation";
import { ErrorState, UnauthorizedState } from "@/components/ui/States";
import { requirePage } from "@/lib/agency-auth";
import { ageFromDob } from "@/lib/format";
import { photoUrls, type StoredPhoto } from "@/features/media/urls";
import { TalentHeader } from "@/features/talent/components/TalentHeader";
import { TalentTabBody } from "@/features/talent/components/TalentTabs";
import { getPrivateDetails, getTalent } from "@/features/talent/queries";
import { TALENT_TABS, visibleTabs, type TalentTabKey } from "@/features/talent/tabs";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePage("talent.view");
  if (!context) return { title: "Talent" };
  const talent = await getTalent(context.supabase, (await params).id).catch(() => null);
  return { title: talent?.display_name ?? "Talent" };
}

export default async function TalentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const context = await requirePage("talent.view");
  if (!context) return <UnauthorizedState />;
  const [{ id }, { tab: requested }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { supabase, permissions } = context;
  const talent = await getTalent(supabase, id).catch((error) => { console.error("[talent] load failed", error); return undefined; });
  if (talent === undefined) return <ErrorState title="This talent record could not be loaded" />;
  if (!talent) notFound();

  const tabs = visibleTabs(permissions);
  const known = TALENT_TABS.find((tab) => tab.key === requested);
  if (known && !permissions.has(known.permission)) return <UnauthorizedState />;
  const active: TalentTabKey = (known?.key ?? tabs[0].key);

  const [privateDetails, cover, boardCount] = await Promise.all([
    permissions.has("talent.private.view") ? getPrivateDetails(supabase, id).catch(() => null) : null,
    permissions.has("media.view")
      ? supabase.from("talent_photos").select("id,storage_bucket,storage_path,public_storage_path").eq("talent_id", id).is("archived_at", null).order("featured", { ascending: false }).order("display_order").limit(1).maybeSingle<StoredPhoto>()
      : Promise.resolve({ data: null }),
    supabase.from("talent_board_assignments").select("board_id", { count: "exact", head: true }).eq("talent_id", id).then((result) => result.count ?? 0),
  ]);
  const coverUrl = cover.data ? (await photoUrls(supabase, [cover.data])).get(cover.data.id) ?? null : null;

  let body: React.ReactNode;
  try {
    body = await TalentTabBody({ tab: active, talent, supabase, permissions });
  } catch (error) {
    console.error(`[talent] ${active} tab failed`, error);
    body = <ErrorState title="This section could not be loaded" />;
  }

  return <div className="space-y-6">
    <Link href="/dashboard/talent" className="text-[10px] font-800 uppercase tracking-[.14em] text-[#8d8f88] hover:text-[#20211f]">← Roster</Link>
    <TalentHeader talent={talent} age={ageFromDob(privateDetails?.date_of_birth)} thumbnail={coverUrl} boardCount={boardCount}
      canPublish={permissions.has("talent.publish")} canArchive={permissions.has("talent.archive")} />
    <nav aria-label="Talent record sections" className="-mx-1 flex gap-x-1 overflow-x-auto border-b border-[#e7e7e3] px-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => <Link key={tab.key} href={`/dashboard/talent/${id}?tab=${tab.key}`} aria-current={tab.key === active ? "page" : undefined}
        className={`whitespace-nowrap border-b-2 px-3 py-3 text-[10px] font-800 uppercase tracking-[.12em] ${tab.key === active ? "border-[#c26a48] text-[#c26a48]" : "border-transparent text-[#8d8f88] hover:text-[#20211f]"}`}>{tab.label}</Link>)}
    </nav>
    {body}
  </div>;
}
