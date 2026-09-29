"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { TalentCard } from "@/components/TalentCard";
import type { Talent } from "@/lib/data";

export function ModelsDirectory({ talents }: { talents: Talent[] }) {
  const [query, setQuery] = useState("");
  const [board, setBoard] = useState("All boards");
  const boards = ["All boards", "Women / Mainboard", "Women / Development", "Women / Curve", "Men / Mainboard", "Men / Development", "Men / Commercial"];
  const filtered = useMemo(() => talents.filter((talent) => {
    const matchesQuery = `${talent.name} ${talent.location} ${talent.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (board === "All boards" || talent.board === board);
  }), [board, query, talents]);

  return (
    <>
      <div className="mb-10 flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {boards.map((item) => <button key={item} onClick={() => setBoard(item)} className={`rounded-full border px-4 py-2 text-[10px] font-800 uppercase tracking-[.11em] transition-colors ${board === item ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] hover:border-[var(--ink)]"}`}>{item}</button>)}
        </div>
        <label className="flex items-center gap-3 border-b border-[var(--line)] pb-2 text-[11px] text-[var(--muted)]"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search talent" className="w-40 bg-transparent outline-none placeholder:text-[var(--muted)]" /></label>
      </div>
      <div className="mb-8 flex items-center justify-between text-[10px] font-800 uppercase tracking-[.15em] text-[var(--muted)]"><span>{filtered.length} talents</span><button className="flex items-center gap-2"><SlidersHorizontal size={14} /> Filters</button></div>
      {filtered.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-6">{filtered.map((talent, index) => <TalentCard key={talent.id} talent={talent} index={index} />)}</div> : <div className="flex min-h-72 items-center justify-center border border-dashed border-[var(--line)] text-sm text-[var(--muted)]">No talent matches this search.</div>}
    </>
  );
}
