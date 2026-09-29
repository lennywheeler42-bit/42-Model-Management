import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { ModelsDirectory } from "./ModelsDirectory";
import { getPublicTalents } from "@/lib/live-data";

export const metadata = { title: "Models" };

export const dynamic = "force-dynamic";

export default async function ModelsPage() {
  const talents = await getPublicTalents();
  return (
    <main className="min-h-screen bg-[var(--paper)]">
      <SiteHeader />
      <section className="container pb-16 pt-36 sm:pb-24 sm:pt-48">
        <div className="flex flex-col justify-between gap-8 border-b border-[var(--line)] pb-12 md:flex-row md:items-end">
          <div><p className="eyebrow mb-5 text-[var(--accent)]">The roster / 2026</p><h1 className="display text-[clamp(72px,13vw,180px)] leading-[.72] tracking-[-.06em]">All <em>talent.</em></h1></div>
          <div className="max-w-xs text-[13px] leading-6 text-[var(--muted)]"><p>Explore our working roster by board, discipline, or name.</p><Link href="/#contact" className="mt-5 flex w-fit items-center gap-2 border-b border-[var(--ink)] pb-1 text-[10px] font-800 uppercase tracking-[.14em]">Book talent <ArrowUpRight size={14} /></Link></div>
        </div>
        <div className="pt-12"><ModelsDirectory talents={talents} /></div>
      </section>
    </main>
  );
}
