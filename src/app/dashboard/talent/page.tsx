import { ErrorState, UnauthorizedState } from "@/components/ui/States";
import { requirePage } from "@/lib/agency-auth";
import { listTalent, loadBoards } from "@/features/talent/queries";
import { TalentListView, type TalentSearch } from "@/features/talent/components/TalentListView";

export const metadata = { title: "Talent" };

export default async function TalentListPage({ searchParams }: { searchParams: Promise<TalentSearch> }) {
  const context = await requirePage("talent.view");
  if (!context) return <UnauthorizedState />;
  const search = await searchParams;

  let data: [Awaited<ReturnType<typeof listTalent>>, Awaited<ReturnType<typeof loadBoards>>];
  try {
    data = await Promise.all([
      listTalent(context.supabase, context.permissions, { q: search.q, status: search.status, board: search.board, page: Number(search.page) || 1 }),
      loadBoards(context.supabase),
    ]);
  } catch (error) {
    console.error("[talent] list failed", error);
    return <ErrorState title="Talent could not be loaded" />;
  }
  return <TalentListView result={data[0]} boards={data[1].flat} search={search} canCreate={context.permissions.has("talent.create")} />;
}
