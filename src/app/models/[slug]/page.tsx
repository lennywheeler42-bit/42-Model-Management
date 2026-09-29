import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { TalentCard } from "@/components/TalentCard";
import { getPublicTalent, getPublicTalents } from "@/lib/live-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const talent = await getPublicTalent(slug);
  return { title: talent?.name ?? "Talent profile", description: talent?.bio };
}

export default async function TalentProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const talent = await getPublicTalent(slug);
  if (!talent) notFound();
  const related = (await getPublicTalents(talent.boardSlug)).filter((item) => item.id !== talent.id).slice(0, 3);
  return (
    <main className="bg-[var(--paper)]">
      <SiteHeader />
      <section className="container pt-32 sm:pt-40">
        <Link href="/models" className="mb-10 flex w-fit items-center gap-2 text-[10px] font-800 uppercase tracking-[.16em] text-[var(--muted)]"><ArrowLeft size={14} /> Back to roster</Link>
        <div className="grid gap-6 md:grid-cols-[1.1fr_.9fr]">
          <div className="image-hover relative aspect-[.82] max-h-[820px] bg-[#ddd8cf] md:aspect-[.78]"><Image src={talent.image} alt={talent.name} fill priority sizes="(max-width: 768px) 100vw, 55vw" className="object-cover" /></div>
          <div className="flex flex-col justify-between bg-[#e8e4dc] p-6 sm:p-10 md:p-12">
            <div><p className="eyebrow mb-6 text-[var(--accent)]">{talent.board}</p><h1 className="display text-[clamp(72px,9vw,135px)] leading-[.77] tracking-[-.05em]">{talent.firstName}<br /><em>{talent.lastName}</em></h1><p className="mt-8 max-w-sm text-[14px] leading-7 text-[var(--muted)]">{talent.bio}</p></div>
            <div className="mt-20"><div className="grid grid-cols-2 border-t border-[var(--line)]">{talent.stats.map((stat) => <div key={stat.label} className="border-b border-r border-[var(--line)] py-4 pr-3 last:border-r-0"><p className="text-[9px] font-800 uppercase tracking-[.14em] text-[var(--muted)]">{stat.label}</p><p className="mt-1 text-[13px] font-700">{stat.value}</p></div>)}</div><a href="mailto:bookings@42modelmanagement.com" className="mt-8 flex w-fit items-center gap-3 text-[10px] font-800 uppercase tracking-[.16em]">Enquire about {talent.firstName} <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-white"><ArrowUpRight size={14} /></span></a></div>
          </div>
        </div>
      </section>
      <section className="container py-20 sm:py-32"><div className="mb-8 flex items-end justify-between border-b border-[var(--line)] pb-5"><div><p className="eyebrow mb-3 text-[var(--accent)]">Selected work</p><h2 className="display text-5xl">Portfolio</h2></div><span className="text-[10px] font-800 uppercase tracking-[.15em] text-[var(--muted)]">{talent.gallery.length} images</span></div><div className="grid grid-cols-2 gap-4 md:grid-cols-3">{talent.gallery.map((src, index) => <div key={src} className={`image-hover relative aspect-[.78] bg-[#dedbd4] ${index === 1 ? "md:mt-16" : ""}`}><Image src={src} alt={`${talent.name} portfolio image ${index + 1}`} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" /></div>)}</div></section>
      {related.length > 0 && <section className="bg-[#e6e1d8] py-20 sm:py-28"><div className="container"><div className="mb-10 border-b border-[var(--line)] pb-5"><p className="eyebrow mb-3 text-[var(--accent)]">From the same board</p><h2 className="display text-5xl">You may also like</h2></div><div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">{related.map((item, index) => <TalentCard key={item.id} talent={item} index={index} />)}</div></div></section>}
    </main>
  );
}
