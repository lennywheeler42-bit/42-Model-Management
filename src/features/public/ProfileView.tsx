import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { TalentCard } from "@/components/TalentCard";
import { embedUrl } from "@/features/media/video";
import { CONTACT_EMAIL } from "@/lib/site";
import type { PublicProfile, TalentCardData } from "./types";

// Public talent profile. Rendered for live profiles and for staff previews, so a
// preview shows exactly what publishing will show.
export function ProfileView({ talent, related = [], backHref = "/models" }: { talent: PublicProfile; related?: TalentCardData[]; backHref?: string }) {
  const board = talent.boards[0];
  const facts = [talent.location, talent.age !== null ? `${talent.age} years` : null].filter(Boolean).join(" · ");
  return <>
    <section className="container pt-32 sm:pt-40">
      <Link href={backHref} className="mb-10 inline-flex items-center gap-2 text-[10px] font-800 uppercase tracking-[.16em] text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft size={14} aria-hidden /> Back to roster</Link>
      <div className="grid gap-6 md:grid-cols-[1.1fr_.9fr]">
        <div className="image-hover relative aspect-[.82] max-h-[820px] bg-[#ddd8cf] md:aspect-[.78]">
          <Image src={talent.image} alt={talent.imageAlt} fill priority sizes="(max-width: 768px) 100vw, 55vw" className="object-cover" />
        </div>
        <div className="flex flex-col justify-between bg-[#e8e4dc] p-6 sm:p-10 md:p-12">
          <div>
            {board && <Link href={`/models/${board.path}`} className="eyebrow mb-6 inline-block text-[var(--accent)] hover:underline">{board.name}</Link>}
            <h1 className="display text-[clamp(64px,9vw,135px)] leading-[.77] tracking-[-.05em]">{talent.firstName}{talent.lastName && <><br /><em>{talent.lastName}</em></>}</h1>
            {facts && <p className="mt-6 text-[11px] font-800 uppercase tracking-[.16em] text-[var(--muted)]">{facts}</p>}
            {talent.bio && <p className="mt-6 max-w-sm text-[14px] leading-7 text-[var(--muted)]">{talent.bio}</p>}
          </div>
          <div className="mt-16">
            {talent.stats.length > 0 && <dl className="grid grid-cols-2 border-t border-[var(--line)] sm:grid-cols-3">
              {talent.stats.map((stat) => <div key={stat.label} className="border-b border-[var(--line)] py-4 pr-3">
                <dt className="text-[9px] font-800 uppercase tracking-[.14em] text-[var(--muted)]">{stat.label}</dt>
                <dd className="mt-1 text-[13px] font-700">{stat.value}</dd>
              </div>)}
            </dl>}
            <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Booking enquiry: ${talent.name}`)}`} className="mt-8 flex w-fit items-center gap-3 text-[10px] font-800 uppercase tracking-[.16em]">
              Enquire about {talent.firstName}<span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ink)]"><ArrowUpRight size={14} aria-hidden /></span>
            </a>
          </div>
        </div>
      </div>
    </section>

    {talent.gallery.length > 0 && <Gallery title="Selected work" heading="Portfolio" images={talent.gallery} />}
    {talent.portfolios.map((portfolio) => <Gallery key={portfolio.id} title={portfolio.kind === "digitals" ? "Digitals" : "Book"} heading={portfolio.name} images={portfolio.images} />)}

    {talent.videos.length > 0 && <section className="container pb-20 sm:pb-28">
      <SectionHeading eyebrow="In motion" title="Video" />
      <div className="grid gap-6 md:grid-cols-2">{talent.videos.map((video) => {
        const embed = video.externalId ? embedUrl(video.provider, video.externalId) : null;
        return <div key={video.id} className="relative aspect-video overflow-hidden bg-[#1f1f1d]">
          {embed
            ? <iframe src={embed} title={video.title || `${talent.name} video`} loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className="absolute inset-0 h-full w-full border-0" />
            : video.src && <video src={video.src} controls preload="metadata" className="absolute inset-0 h-full w-full object-cover" aria-label={video.title || `${talent.name} video`} />}
        </div>;
      })}</div>
    </section>}

    {talent.skills.length > 0 && <section className="container pb-20 sm:pb-28">
      <SectionHeading eyebrow="Also" title="Skills" />
      <ul className="flex flex-wrap gap-2">{talent.skills.map((skill) => <li key={`${skill.category}-${skill.skill}`} className="rounded-full border border-[var(--line)] px-4 py-2 text-[11px] font-700">
        {skill.skill}<span className="ml-2 text-[var(--muted)]">{[skill.category !== skill.skill ? skill.category : null, skill.level].filter(Boolean).join(" · ")}</span>
      </li>)}</ul>
    </section>}

    {related.length > 0 && <section className="bg-[#e6e1d8] py-20 sm:py-28"><div className="container">
      <SectionHeading eyebrow="From the same board" title="You may also like" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">{related.map((item, index) => <TalentCard key={item.id} talent={item} index={index} />)}</div>
    </div></section>}
  </>;
}

function SectionHeading({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: string }) {
  return <div className="mb-8 flex items-end justify-between border-b border-[var(--line)] pb-5">
    <div><p className="eyebrow mb-3 text-[var(--accent)]">{eyebrow}</p><h2 className="display text-5xl">{title}</h2></div>
    {aside && <span className="text-[10px] font-800 uppercase tracking-[.15em] text-[var(--muted)]">{aside}</span>}
  </div>;
}

function Gallery({ title, heading, images }: { title: string; heading: string; images: { src: string; alt: string }[] }) {
  return <section className="container py-20 sm:py-28">
    <SectionHeading eyebrow={title} title={heading} aside={`${images.length} image${images.length === 1 ? "" : "s"}`} />
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{images.map((image, index) => <div key={`${image.src}-${index}`} className={`image-hover relative aspect-[.78] bg-[#dedbd4] ${index % 3 === 1 ? "md:mt-16" : ""}`}>
      <Image src={image.src} alt={image.alt} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />
    </div>)}</div>
  </section>;
}
