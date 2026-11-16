import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, UnauthorizedState } from "@/components/ui/States";
import { requirePage } from "@/lib/agency-auth";
import { log } from "@/lib/log";
import { loadBoards, photoCounts } from "@/features/talent/queries";
import { NO_PHOTOS, type WebsiteRow } from "@/features/talent/website";
import { WebsiteCheck } from "@/features/talent/components/WebsiteCheck";

export const metadata = { title: "Website check" };

type Row = { id: string; display_name: string; publication_status: string; show_on_website: boolean; is_minor: boolean; consent_status: string; talent_board_assignments: { board_id: string }[] };

// Every active talent and where it stands with the website: live, no photo, or not
// shown yet, with one action to show everyone who has photos.
export default async function WebsiteCheckPage() {
  const context = await requirePage(["talent.view", "media.view"]);
  if (!context) return <UnauthorizedState />;
  const { supabase, permissions } = context;

  let rows: WebsiteRow[];
  try {
    const [talent, boards] = await Promise.all([
      supabase.from("talent").select("id,display_name,publication_status,show_on_website,is_minor,consent_status,talent_board_assignments(board_id)")
        .neq("publication_status", "archived").is("archived_at", null).order("display_name").limit(1000),
      loadBoards(supabase),
    ]);
    if (talent.error) throw talent.error;
    const list = (talent.data ?? []) as unknown as Row[];
    const counts = await photoCounts(supabase, list.map((row) => row.id));
    if (!counts) throw new Error("photo counts unavailable");
    const publicBoards = new Set(boards.flat.filter((board) => board.isPublic).map((board) => board.id));
    rows = list.map(({ talent_board_assignments, ...row }) => ({
      ...row, archived: false, counts: counts.get(row.id) ?? NO_PHOTOS,
      boards: talent_board_assignments.length, publicBoards: talent_board_assignments.filter((assignment) => publicBoards.has(assignment.board_id)).length,
    }));
  } catch (error) {
    log.error("talent", "website check failed", error);
    return <ErrorState title="The website check could not be loaded" />;
  }

  return <div className="space-y-6">
    <Link href="/dashboard/talent" className="inline-flex items-center gap-2 text-xs text-[#6b6d66] hover:text-[#20211f]"><ArrowLeft size={14} aria-hidden />Roster</Link>
    <PageHeader eyebrow="Talent" title="Website check" description="Who is on the website, who is not, and why. A talent with no photo is never shown: add a photo in their Media tab and they appear." />
    <WebsiteCheck rows={rows} canPublish={permissions.has("talent.publish") && permissions.has("media.manage")} />
  </div>;
}
