"use client";

import { Badge } from "@/components/ui/Badge";
import { useMutation } from "@/lib/use-mutation";

type BoardChoice = { id: string; label: string; depth: number; isPublic: boolean; isActive: boolean };

// A talent can sit on any number of boards. Toggling saves immediately; removing a
// board only removes the assignment, never the talent.
export function BoardAssignments({ talentId, boards, assigned, canAssign }: { talentId: string; boards: BoardChoice[]; assigned: string[]; canAssign: boolean }) {
  const { run, pending } = useMutation();

  async function toggle(board: BoardChoice, checked: boolean) {
    await run(`/api/dashboard/talents/${talentId}/boards`, {
      method: checked ? "POST" : "DELETE",
      body: { board_id: board.id },
      success: checked ? `Added to ${board.label}` : `Removed from ${board.label}`,
    });
  }

  return <section className="space-y-3">
    <div><h3 className="text-sm font-800">Boards</h3><p className="mt-1 text-xs text-[#8d8f88]">Published talent appears on every public board they are assigned to. Internal boards never appear on the website.</p></div>
    {boards.length ? <ul className="grid gap-2 sm:grid-cols-2">{boards.map((board) => <li key={board.id}>
      <label className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-xs ${assigned.includes(board.id) ? "border-[#20211f] bg-[#fafaf8]" : "border-[#e7e7e3]"} ${canAssign ? "cursor-pointer" : "opacity-70"}`}>
        <input type="checkbox" className="h-4 w-4 accent-[#20211f]" checked={assigned.includes(board.id)} disabled={!canAssign || pending} onChange={(event) => toggle(board, event.target.checked)} />
        <span className="flex-1">{board.label}</span>
        {!board.isActive ? <Badge tone="inactive">Inactive</Badge> : !board.isPublic ? <Badge tone="internal">Internal</Badge> : <Badge tone="public">Public</Badge>}
      </label>
    </li>)}</ul> : <p className="text-xs text-[#8d8f88]">No boards exist yet. Create them under Boards.</p>}
  </section>;
}
