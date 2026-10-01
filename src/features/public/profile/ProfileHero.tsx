"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Play } from "lucide-react";
import type { ProfileImage } from "../types";

const pad = (value: number) => String(value).padStart(2, "0");

// Full-bleed hero: up to three photos that cross-fade every 6 seconds (paused
// while hovered or focused, and never for people who prefer reduced motion).
export function ProfileHero({ images, name, categories, location, hasVideo, backHref }: {
  images: ProfileImage[]; name: string; categories: string[]; location: string; hasVideo: boolean; backHref: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = images.length;

  useEffect(() => {
    if (count < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), 6000);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  return <section aria-label={`${name}, cover photos`} className="relative h-[86svh] min-h-[560px] overflow-hidden bg-[var(--ink)] text-white md:h-[min(82vh,780px)]"
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    {images.map((image, position) => <Image key={`${image.src}-${position}`} src={image.src} alt={position === index ? image.alt : ""} fill priority={position === 0}
      sizes="100vw" className={`object-cover object-[center_22%] transition-opacity duration-[1200ms] ease-out ${position === index ? "opacity-100" : "opacity-0"}`} />)}
    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/45 md:bg-gradient-to-r md:from-black/70 md:via-black/25 md:to-black/5" />
    <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/50 to-transparent" />

    <div className="container relative flex h-full flex-col justify-end pb-10 md:justify-center md:pb-0 md:pt-20">
      <Link href={backHref} className="label-sm mb-8 hidden w-fit items-center gap-2 text-white/70 hover:text-white md:inline-flex"><ArrowLeft size={13} aria-hidden /> Roster</Link>
      {categories.length > 0 && <p className="label-sm mb-4 text-white/80 md:mb-5">{categories.join("  /  ")}</p>}
      <h1 className="display max-w-[14ch] text-[clamp(52px,11vw,132px)] uppercase leading-[.86] tracking-[-.01em]">{name}</h1>
      {location && <p className="label mt-5 text-white/85">{location}</p>}
      {hasVideo && <a href="#video" className="label mt-8 flex w-fit items-center gap-4 text-white hover:opacity-80 md:mt-10">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/80 md:h-12 md:w-12"><Play size={16} fill="currentColor" aria-hidden className="ml-0.5" /></span>
        Watch video
      </a>}
      <a href="#portfolio" aria-label="Scroll to portfolio" className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 text-white/70 hover:text-white md:block lg:left-[calc((100%-min(1280px,100%-48px))/2+44px)] lg:translate-x-0">
        <ChevronDown size={26} strokeWidth={1} aria-hidden />
      </a>
    </div>

    {count > 1 && <div className="absolute bottom-10 right-[max(24px,calc((100%-1280px)/2))] flex items-center gap-2 text-[11px] font-500 tracking-[.18em] text-white/80 sm:gap-3">
      <span aria-live="polite">{pad(index + 1)}</span>
      <span className="flex gap-1.5">{images.map((image, position) => <button key={`${image.src}-dot-${position}`} type="button" onClick={() => setIndex(position)} aria-label={`Show photo ${position + 1} of ${count}`}
        className={`h-px w-4 transition-colors sm:w-8 md:w-10 ${position === index ? "bg-white" : "bg-white/35 hover:bg-white/70"}`} />)}</span>
      <span>/ {pad(count)}</span>
    </div>}
  </section>;
}
