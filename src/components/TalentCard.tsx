import Image from "next/image";
import Link from "next/link";
import type { Talent } from "@/lib/data";

export function TalentCard({ talent, index = 0 }: { talent: Talent; index?: number }) {
  return (
    <Link href={`/models/${talent.slug}`} className="group block fade-up" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="image-hover relative aspect-[.76] bg-[#dedbd4]">
        <Image src={talent.image} alt={`${talent.name} — 42 Model Management`} fill sizes="(max-width: 700px) 50vw, 25vw" className="object-cover" />
        <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[9px] font-800 uppercase tracking-[.14em] backdrop-blur">{talent.board.split(" / ").pop()}</span>
        <span className="absolute bottom-3 right-3 flex h-8 w-8 translate-y-2 items-center justify-center rounded-full bg-white text-sm opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">↗</span>
      </div>
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] py-4">
        <div>
          <h3 className="display text-[25px] leading-none">{talent.name}</h3>
          <p className="mt-1 text-[10px] font-700 uppercase tracking-[.13em] text-[var(--muted)]">{talent.location}</p>
        </div>
        <span className="pt-1 text-[10px] font-800 uppercase tracking-[.12em] text-[var(--muted)]">{talent.height}</span>
      </div>
    </Link>
  );
}

