"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { TalentCard } from "@/components/TalentCard";
import type { PublicBoard, TalentCardData } from "@/features/public/types";

// Client-side refinement of an already-public roster: name/location search and
// board chips taken from the published boards.
export function ModelsDirectory({ talents, boards }: { talents: TalentCardData[]; boards: PublicBoard[] }) {
  const [query, setQuery] = useState("");
  const [top, setTop] = useState<PublicBoard | null>(null);
  const [sub, setSub] = useState<PublicBoard | null>(null);
  const board = sub?.path ?? top?.path ?? null;
  const roots = boards.filter((item) => item.depth === 0);
  const children = top ? boards.filter((item) => item.parent_id === top.id) : [];
  const filtered = useMemo(() => talents.filter((talent) => {
    const matchesQuery = `${talent.name} ${talent.location}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesBoard = !board || talent.boardPaths.some((path) => path === board || path.startsWith(`${board}/`));
    return matchesQuery && matchesBoard;
  }), [board, query, talents]);

  const chip = (active: boolean) => `rounded-full border px-4 py-2 text-[10px] font-800 uppercase tracking-[.11em] transition-colors ${active ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] hover:border-[var(--ink)]"}`;
  return (
    <>
      <div className="mb-10 flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by board">
            <button type="button" aria-pressed={!top} onClick={() => { setTop(null); setSub(null); }} className={chip(!top)}>All boards</button>
            {roots.map((item) => <button key={item.id} type="button" aria-pressed={top?.id === item.id} onClick={() => { setTop(item); setSub(null); }} className={chip(top?.id === item.id)}>{item.name}</button>)}
          </div>
          {children.length > 0 && <div className="flex flex-wrap gap-2 pl-1" role="group" aria-label={`${top?.name} boards`}>
            <button type="button" aria-pressed={!sub} onClick={() => setSub(null)} className={`${chip(!sub)} !px-3 !py-1.5`}>All {top?.name}</button>
            {children.map((item) => <button key={item.id} type="button" aria-pressed={sub?.id === item.id} onClick={() => setSub(item)} className={`${chip(sub?.id === item.id)} !px-3 !py-1.5`}>{item.name.split(" / ").pop()}</button>)}
          </div>}
        </div>
        <label className="flex items-center gap-3 border-b border-[var(--line)] pb-2 text-[11px] text-[var(--muted)]"><Search size={15} aria-hidden /><span className="sr-only">Search talent</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search talent" className="w-44 bg-transparent outline-none placeholder:text-[var(--muted)]" />
        </label>
      </div>
      <div className="mb-8 flex items-center justify-between text-[10px] font-800 uppercase tracking-[.15em] text-[var(--muted)]">
        <span aria-live="polite">{filtered.length} {filtered.length === 1 ? "talent" : "talents"}</span>
        {board && <Link href={`/models/${board}`} className="hover:text-[var(--ink)]">Open board page ↗</Link>}
      </div>
      {filtered.length
        ? <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 lg:grid-cols-4 md:gap-x-6">{filtered.map((talent, index) => <TalentCard key={talent.id} talent={talent} index={index} />)}</div>
        : <div className="flex min-h-72 items-center justify-center border border-dashed border-[var(--line)] text-sm text-[var(--muted)]">{talents.length ? "No talent matches this search." : "The roster is being updated. Please check back soon."}</div>}
    </>
  );
}
