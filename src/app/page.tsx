import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { TalentCard } from "@/components/TalentCard";
import { getRoster } from "@/features/public/queries";
import { CONTACT_EMAIL } from "@/lib/site";

const heroImage = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1800&q=90";

export default async function Home() {
  // Rendered per request from cached data (see features/public/cache.ts).
  await connection();
  const publicTalents = await getRoster({ limit: 8 });
  return (
    <main className="overflow-hidden">
      <section className="relative flex min-h-[min(860px,100vh)] items-end bg-[#6d6960] text-white">
        <Image src={heroImage} alt="Editorial portrait represented by 42 Model Management" fill priority sizes="100vw" className="object-cover object-center opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-black/15" />
        <SiteHeader dark />
        <div className="container relative z-10 pb-14 pt-40 sm:pb-20">
          <div className="flex flex-col justify-between gap-12 md:flex-row md:items-end">
            <div className="max-w-4xl">
              <p className="eyebrow mb-6 text-white/70">Independent talent / Dallas–Fort Worth</p>
              <h1 className="display max-w-4xl text-[clamp(72px,13vw,190px)] leading-[.78] tracking-[-.06em]">The faces<br /><em>of now.</em></h1>
            </div>
            <Link href="/models" className="group flex w-fit items-center gap-4 text-[11px] font-800 uppercase tracking-[.18em]">
              <span className="border-b border-white/60 pb-2">Explore talent</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/50 transition-transform group-hover:rotate-45"><ArrowUpRight size={16} /></span>
            </Link>
          </div>
          <div className="mt-16 flex items-center justify-between border-t border-white/25 pt-4 text-[10px] font-700 uppercase tracking-[.16em] text-white/65">
            <span>Dallas–Fort Worth · USA – UK</span><span className="hidden sm:block">Scroll to discover ↓</span>
          </div>
        </div>
      </section>

      <section className="bg-[var(--paper)] py-24 sm:py-36">
        <div className="container">
          <div className="grid gap-12 md:grid-cols-[1fr_2fr] md:gap-24">
            <div><p className="eyebrow text-[var(--accent)]">A point of view</p></div>
            <div>
              <h2 className="display max-w-4xl text-[clamp(44px,6.5vw,90px)] leading-[.88] tracking-[-.04em]">We represent <em>distinctive</em> people with something to say.</h2>
              <div className="mt-10 flex flex-col justify-between gap-8 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-end">
                <p className="max-w-sm text-[14px] leading-7 text-[var(--muted)]">42 is a full-service model management agency built around long-term relationships, sharp creative instinct, and a belief in the individual.</p>
                <Link href="/#about" className="group flex items-center gap-3 text-[10px] font-800 uppercase tracking-[.16em]">Our approach <ArrowDownRight size={16} className="transition-transform group-hover:translate-y-1 group-hover:translate-x-1" /></Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#e6e1d8] py-20 sm:py-28">
        <div className="container">
          <div className="mb-10 flex items-end justify-between border-b border-[var(--line)] pb-5">
            <div><p className="eyebrow mb-3 text-[var(--accent)]">The roster</p><h2 className="display text-5xl leading-none">Selected talent</h2></div>
            <Link href="/models" className="hidden text-[10px] font-800 uppercase tracking-[.16em] sm:block">View all talent ↗</Link>
          </div>
          {publicTalents.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">{publicTalents.slice(0, 4).map((talent, index) => <TalentCard key={talent.id} talent={talent} index={index} />)}</div> : <p className="border border-dashed border-[var(--line)] px-6 py-16 text-center text-sm text-[var(--muted)]">New faces are being added to the roster. <Link href="/models" className="underline">Browse all talent</Link>.</p>}
        </div>
      </section>

      <section id="about" className="container grid gap-14 py-24 sm:py-36 md:grid-cols-[1fr_1.3fr] md:gap-28">
        <div className="relative aspect-[.85] overflow-hidden bg-[#d7d0c5]">
          <Image src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=85" alt="42 agency editorial portrait" fill sizes="(max-width: 768px) 100vw, 40vw" className="object-cover" />
          <div className="absolute bottom-4 left-4 rounded-full bg-white/85 px-3 py-2 text-[9px] font-800 uppercase tracking-[.14em]">42 Model Management</div>
        </div>
        <div className="flex flex-col justify-center">
          <p className="eyebrow mb-7 text-[var(--accent)]">More than a roster</p>
          <h2 className="display max-w-xl text-[clamp(50px,7vw,100px)] leading-[.84] tracking-[-.04em]">People first.<br /><em>Always.</em></h2>
          <p className="mt-10 max-w-md text-[14px] leading-7 text-[var(--muted)]">From first digitals to global campaigns, we help talent build meaningful careers and give clients access to a roster with range, intention, and staying power.</p>
          <Link href="/#contact" className="mt-10 flex w-fit items-center gap-3 border-b border-[var(--ink)] pb-2 text-[10px] font-800 uppercase tracking-[.16em]">Work with 42 <ArrowUpRight size={15} /></Link>
        </div>
      </section>

      <section id="contact" className="bg-[var(--ink)] py-20 text-white sm:py-28">
        <div className="container">
          <div className="grid gap-16 md:grid-cols-[1.4fr_1fr] md:items-end">
            <div><p className="eyebrow mb-7 text-[#d69172]">Start a conversation</p><h2 className="display max-w-3xl text-[clamp(56px,9vw,124px)] leading-[.8] tracking-[-.05em]">Let&apos;s make<br /><em>something real.</em></h2></div>
            <div className="text-sm leading-7 text-white/60"><p>For bookings, castings, and general inquiries:</p><a href={`mailto:${CONTACT_EMAIL}`} className="mt-2 inline-block border-b border-white/35 pb-1 text-white">{CONTACT_EMAIL}</a><p className="mt-8">Want to be represented?</p><Link href="/join" prefetch={false} className="mt-2 inline-block border-b border-white/35 pb-1 text-white">Apply to join 42 ↗</Link><p className="mt-8">Dallas–Fort Worth · USA – UK</p></div>
          </div>
          <footer className="mt-24 flex flex-col justify-between gap-8 border-t border-white/20 pt-5 text-[10px] font-700 uppercase tracking-[.15em] text-white/45 sm:flex-row"><span>© 42 Model Management</span><div className="flex gap-6"><a href="#">Privacy</a><a href="#">Instagram ↗</a></div></footer>
        </div>
      </section>
    </main>
  );
}
