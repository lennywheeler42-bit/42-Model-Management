import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { TalentCard } from "@/components/TalentCard";
import { cmsMediaUrl, getSiteSettings } from "@/features/cms/queries";
import { getRoster } from "@/features/public/queries";
import { PLACEHOLDER_IMAGE } from "@/features/public/types";

// Two-line display headings: the second line is set in italics.
function Headline({ text }: { text?: string }) {
  const [first, ...rest] = (text ?? "").split("\n");
  return <>{first}{rest.length > 0 && <><br /><em>{rest.join(" ")}</em></>}</>;
}

export default async function Home() {
  // Rendered per request from cached data (see features/public/cache.ts).
  await connection();
  const [publicTalents, settings] = await Promise.all([getRoster({ limit: 8 }), getSiteSettings()]);
  // Hero and About images come from Dashboard → Website → Settings; until they are
  // chosen, the first published talent photo is used, never stock photography.
  const talentImage = publicTalents.find((talent) => talent.image !== PLACEHOLDER_IMAGE)?.image ?? null;
  const heroImage = cmsMediaUrl(settings.home_hero.image_path) ?? talentImage;
  const aboutImage = cmsMediaUrl(settings.home_about.image_path) ?? publicTalents.filter((talent) => talent.image !== PLACEHOLDER_IMAGE)[1]?.image ?? talentImage;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "42 Model Management",
    url: site || undefined,
    email: settings.contact_email,
    telephone: settings.contact_phone ?? undefined,
    sameAs: settings.instagram_url ? [settings.instagram_url] : undefined,
    areaServed: ["US", "GB"],
  };

  return (
    <main className="overflow-hidden">
      <section className="relative flex min-h-[min(860px,100vh)] items-end bg-[var(--ink)] text-white">
        {heroImage && <Image src={heroImage} alt="" fill priority sizes="100vw" className="object-cover object-center opacity-80" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-black/15" />
        <SiteHeader dark />
        <div className="container relative z-10 pb-14 pt-40 sm:pb-20">
          <div className="flex flex-col justify-between gap-12 md:flex-row md:items-end">
            <div className="max-w-4xl">
              {settings.home_hero.eyebrow && <p className="eyebrow mb-6 text-white/70">{settings.home_hero.eyebrow}</p>}
              <h1 className="display max-w-4xl text-[clamp(72px,13vw,190px)] leading-[.78] tracking-[-.06em]"><Headline text={settings.home_hero.headline} /></h1>
              {settings.home_hero.text && <p className="mt-8 max-w-lg text-[15px] leading-7 text-white/75">{settings.home_hero.text}</p>}
            </div>
            <Link href="/models" className="group flex w-fit items-center gap-4 text-[11px] font-800 uppercase tracking-[.18em]">
              <span className="border-b border-white/60 pb-2">Explore talent</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/50 transition-transform group-hover:rotate-45"><ArrowUpRight size={16} /></span>
            </Link>
          </div>
          <div className="mt-16 flex items-center justify-between border-t border-white/25 pt-4 text-[10px] font-700 uppercase tracking-[.16em] text-white/65">
            <span>{settings.location_line}</span><span className="hidden sm:block">Scroll to discover ↓</span>
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
          {aboutImage
            ? <Image src={aboutImage} alt="" fill sizes="(max-width: 768px) 100vw, 40vw" className="object-cover" />
            : <div className="paper-grid h-full" aria-hidden="true" />}
          <div className="absolute bottom-4 left-4 rounded-full bg-white/85 px-3 py-2 text-[9px] font-800 uppercase tracking-[.14em]">42 Model Management</div>
        </div>
        <div className="flex flex-col justify-center">
          {settings.home_about.eyebrow && <p className="eyebrow mb-7 text-[var(--accent)]">{settings.home_about.eyebrow}</p>}
          <h2 className="display max-w-xl text-[clamp(50px,7vw,100px)] leading-[.84] tracking-[-.04em]"><Headline text={settings.home_about.headline} /></h2>
          {settings.home_about.text && <p className="mt-10 max-w-md text-[14px] leading-7 text-[var(--muted)]">{settings.home_about.text}</p>}
          <div className="mt-10 flex flex-wrap gap-8">
            <Link href="/#contact" className="flex w-fit items-center gap-3 border-b border-[var(--ink)] pb-2 text-[10px] font-800 uppercase tracking-[.16em]">Work with 42 <ArrowUpRight size={15} /></Link>
            <Link href="/about" className="flex w-fit items-center gap-3 border-b border-transparent pb-2 text-[10px] font-800 uppercase tracking-[.16em] text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]">Our story</Link>
          </div>
        </div>
      </section>

      <section id="contact" className="bg-[var(--ink)] py-20 text-white sm:py-28">
        <div className="container">
          <div className="grid gap-16 md:grid-cols-[1.4fr_1fr] md:items-end">
            <div><p className="eyebrow mb-7 text-[var(--accent-soft)]">Start a conversation</p><h2 className="display max-w-3xl text-[clamp(56px,9vw,124px)] leading-[.8] tracking-[-.05em]"><Headline text={settings.contact_heading} /></h2></div>
            <div className="text-sm leading-7 text-white/60">
              <p>For bookings, castings, and general inquiries:</p>
              <a href={`mailto:${settings.contact_email}`} className="mt-2 inline-block border-b border-white/35 pb-1 text-white">{settings.contact_email}</a>
              {settings.contact_phone && <p className="mt-2"><a href={`tel:${settings.contact_phone.replace(/[^\d+]/g, "")}`} className="text-white">{settings.contact_phone}</a></p>}
              <p className="mt-8">Want to be represented?</p>
              <Link href="/join" prefetch={false} className="mt-2 inline-block border-b border-white/35 pb-1 text-white">Apply to join 42 ↗</Link>
              {settings.location_line && <p className="mt-8">{settings.location_line}</p>}
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization).replace(/</g, "\\u003c") }} />
    </main>
  );
}
