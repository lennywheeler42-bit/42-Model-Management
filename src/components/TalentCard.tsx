import Image from "next/image";
import Link from "next/link";
import type { TalentCardData } from "@/features/public/types";

export function TalentCard({ talent, index = 0 }: { talent: TalentCardData; index?: number }) {
  return (
    <Link href={`/models/${talent.slug}`} className="group block fade-up focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]" style={{ animationDelay: `${Math.min(index, 12) * 60}ms` }}>
      <div className="image-hover relative aspect-[.76] bg-[#dedbd4]">
        <Image src={talent.image} alt={talent.imageAlt} fill sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw" className="object-cover" />
        {talent.boardLabel && <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[9px] font-800 uppercase tracking-[.14em] backdrop-blur">{talent.boardLabel}</span>}
        <span aria-hidden className="absolute bottom-3 right-3 flex h-8 w-8 translate-y-2 items-center justify-center rounded-full bg-white text-sm opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">↗</span>
      </div>
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] py-4">
        <div>
          <h3 className="display text-[25px] leading-none">{talent.name}</h3>
          {talent.location && <p className="mt-1 text-[10px] font-700 uppercase tracking-[.13em] text-[var(--muted)]">{talent.location}</p>}
        </div>
        {talent.height && <span className="pt-1 text-[10px] font-800 uppercase tracking-[.12em] text-[var(--muted)]">{talent.height}</span>}
      </div>
    </Link>
  );
}
