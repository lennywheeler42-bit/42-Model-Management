"use client";

import { useState } from "react";
import { Download, Star } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/Field";
import { Card } from "@/components/ui/PageHeader";

type Photo = { id: string; url: string; alt: string; public: boolean; cropped: boolean };

const PAGE_SIZE = 32;

// Pick a front photo and up to four for the back from the whole gallery, preview,
// then download the PDF. Nothing is uploaded again.
export function CompCardBuilder({ talentId, name, location, photos, stats, measurementsAllowed }: {
  talentId: string; name: string; location: string | null; photos: Photo[]; stats: { label: string; value: string }[]; measurementsAllowed: boolean;
}) {
  const [front, setFront] = useState(photos[0]?.id ?? "");
  const [back, setBack] = useState<string[]>(photos.slice(1, 5).map((photo) => photo.id));
  const [measurements, setMeasurements] = useState(measurementsAllowed);
  const [websiteOnly, setWebsiteOnly] = useState(false);
  const [shown, setShown] = useState(PAGE_SIZE);
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const toggle = (id: string) => setBack((list) => list.includes(id) ? list.filter((item) => item !== id) : list.length >= 4 ? list : [...list, id]);
  const ids = [front, ...back.filter((id) => id !== front)].filter(Boolean);
  const href = `/api/dashboard/talents/${talentId}/comp-card?photos=${ids.join(",")}&measurements=${measurements ? 1 : 0}`;
  const shownStats = measurements ? stats : [];
  const listed = websiteOnly ? photos.filter((photo) => photo.public) : photos;

  if (!photos.length) return <Card title="No photos yet"><p className="text-sm text-[#6b6d66]">Open the Media tab and add at least one photo to build a comp card.</p></Card>;

  return <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
    <Card title="Choose photos" description={`${photos.length} photo${photos.length === 1 ? "" : "s"} in this gallery. Tap the star for the front photo; tick up to four for the back. Cropped photos print as you framed them. Check that private photos are cleared before sending a card out.`}>
      {photos.some((photo) => photo.public) && photos.some((photo) => !photo.public) && <div className="mb-3"><CheckboxField label="Only photos on the website" name="website_only" checked={websiteOnly} onChange={(value) => { setWebsiteOnly(value); setShown(PAGE_SIZE); }} /></div>}
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">{listed.slice(0, shown).map((photo) => {
        const isFront = photo.id === front;
        const onBack = back.includes(photo.id);
        return <li key={photo.id} className="relative">
          {/* Signed library thumbnail or public talent image; next/image adds nothing in a picker grid. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={photo.alt} className={`aspect-[3/4] w-full rounded-md object-cover ring-2 ${isFront ? "ring-[#a4502f]" : onBack ? "ring-[#20211f]" : "ring-transparent"}`} loading="lazy" decoding="async" />
          <button type="button" aria-pressed={isFront} aria-label={isFront ? "Front photo" : "Use as front photo"} onClick={() => { setFront(photo.id); setBack((list) => list.filter((item) => item !== photo.id)); }}
            className={`absolute left-1.5 top-1.5 rounded-full p-1.5 shadow ${isFront ? "bg-[#a4502f] text-white" : "bg-white/90 text-[#5f615b]"}`}><Star size={12} /></button>
          {!isFront && <label className="absolute right-1.5 top-1.5 flex items-center rounded bg-white/90 p-1 shadow"><input type="checkbox" checked={onBack} onChange={() => toggle(photo.id)} disabled={!onBack && back.length >= 4} className="h-4 w-4 accent-[#20211f]" /><span className="sr-only">Use on the back</span></label>}
          <div className="absolute bottom-1.5 left-1.5 flex gap-1">
            {!photo.public && <span className="rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-800 text-[#5f615b]">Private</span>}
            {photo.cropped && <span className="rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-800 text-[#5f615b]">Cropped</span>}
          </div>
        </li>;
      })}</ul>
      {listed.length > shown && <div className="mt-4 flex justify-center"><Button variant="secondary" onClick={() => setShown((count) => count + PAGE_SIZE)}>Show more ({listed.length - shown} left)</Button></div>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <CheckboxField label="Include measurements" name="measurements" checked={measurements} onChange={setMeasurements} disabled={!measurementsAllowed}
          hint={measurementsAllowed ? undefined : "This talent's measurements are not public, so they are never printed."} />
        <a href={href} target="_blank" rel="noopener" className={buttonClass("primary")}><Download size={14} aria-hidden />Download PDF</a>
      </div>
    </Card>

    <div className="space-y-3" aria-label="Preview">
      <p className="text-[10px] font-800 uppercase tracking-[.14em] text-[#6b6d66]">Preview</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="aspect-[5.5/8.5] overflow-hidden rounded-md bg-white p-2 shadow-sm ring-1 ring-[#e7e7e3]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {byId.get(front) && <img src={byId.get(front)!.url} alt="" className="h-[84%] w-full object-cover" />}
          <p className="mt-1.5 truncate text-[11px] font-800 uppercase">{name}</p>
          {location && <p className="truncate text-[8px] uppercase tracking-[.12em] text-[#6b6d66]">{location}</p>}
        </div>
        <div className="flex aspect-[5.5/8.5] flex-col overflow-hidden rounded-md bg-white p-2 shadow-sm ring-1 ring-[#e7e7e3]">
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-1">{back.map((id) => byId.get(id)).filter(Boolean).map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={photo!.id} src={photo!.url} alt="" className="h-full min-h-0 w-full object-cover" />
          ))}</div>
          {shownStats.length > 0 && <p className="mt-1.5 text-[7px] leading-tight text-[#5f615b]">{shownStats.map((stat) => `${stat.label} ${stat.value}`).join(" · ")}</p>}
          <p className="mt-1 text-[7px] font-800 uppercase tracking-[.12em] text-[#9e1923]">42 Model Management</p>
        </div>
      </div>
    </div>
  </div>;
}
