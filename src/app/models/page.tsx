import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { TalentCard } from "@/components/TalentCard";
import { activeFilterCount, parseRosterFilters, rosterQuery } from "@/features/public/filters";
import { getPublicBoards } from "@/features/public/queries";
import { getFilterOptions, searchRoster } from "@/features/public/search";
import { RosterFilterBar } from "./RosterFilterBar";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Filtered and paged views are shareable but not indexed; the plain roster is canonical.
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const filters = parseRosterFilters(await searchParams);
  const filtered = activeFilterCount(filters) > 0 || (filters.page ?? 1) > 1;
  return {
    title: "Models",
    description: "Explore the 42 Model Management roster by board, height, location, skills and more.",
    alternates: { canonical: "/models" },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function ModelsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseRosterFilters(await searchParams);
  const [result, boards, options] = await Promise.all([searchRoster(filters), getPublicBoards(), getFilterOptions()]);
  const filtered = activeFilterCount(filters) > 0;
  const pageHref = (page: number) => `/models${rosterQuery(filters, { page })}`;

  return (
    <main className="min-h-screen bg-[var(--paper)]">
      <SiteHeader />
      <section className="container pb-16 pt-36 sm:pb-24 sm:pt-48">
        <div className="flex flex-col justify-between gap-8 border-b border-[var(--line)] pb-12 md:flex-row md:items-end">
          <div><p className="eyebrow mb-5 text-[var(--accent)]">The roster</p><h1 className="display text-[clamp(72px,13vw,180px)] leading-[.72] tracking-[-.06em]">All <em>talent.</em></h1></div>
          <div className="max-w-xs text-[13px] leading-6 text-[var(--muted)]"><p>Search our working roster by board, measurements, location, or skills.</p><Link href="/#contact" className="mt-5 flex w-fit items-center gap-2 border-b border-[var(--ink)] pb-1 text-[10px] font-800 uppercase tracking-[.14em]">Book talent <ArrowUpRight size={14} aria-hidden /></Link></div>
        </div>
        <div className="pt-12">
          <RosterFilterBar key={rosterQuery(filters, { page: undefined })} filters={filters} boards={boards} options={options} />
          <div className="mb-8 flex items-center justify-between text-[10px] font-800 uppercase tracking-[.15em] text-[var(--muted)]">
            <span aria-live="polite">{result.total} {result.total === 1 ? "talent" : "talents"}{result.pageCount > 1 ? ` · page ${result.page} of ${result.pageCount}` : ""}</span>
            {filters.board && <Link href={`/models/${filters.board}`} className="hover:text-[var(--ink)]">Open board page ↗</Link>}
          </div>
          {result.talents.length
            ? <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">{result.talents.map((talent, index) => <TalentCard key={talent.id} talent={talent} index={index} />)}</div>
            : <div className="flex min-h-72 flex-col items-center justify-center gap-4 border border-dashed border-[var(--line)] px-6 text-center text-sm text-[var(--muted)]">
                {filtered || result.page > 1 ? <>No talent matches these filters.<Link href="/models" className="text-[10px] font-800 uppercase tracking-[.14em] text-[var(--ink)] underline underline-offset-4">Clear filters</Link></> : "The roster is being updated. Please check back soon."}
              </div>}
          {result.pageCount > 1 && <nav aria-label="Roster pages" className="mt-16 flex items-center justify-between border-t border-[var(--line)] pt-6 text-[10px] font-800 uppercase tracking-[.14em]">
            {result.page > 1 ? <Link href={pageHref(result.page - 1)} rel="prev">← Previous</Link> : <span className="text-[var(--muted)] opacity-50">← Previous</span>}
            <span className="text-[var(--muted)]">{result.page} / {result.pageCount}</span>
            {result.page < result.pageCount ? <Link href={pageHref(result.page + 1)} rel="next">Next →</Link> : <span className="text-[var(--muted)] opacity-50">Next →</span>}
          </nav>}
        </div>
      </section>
    </main>
  );
}
