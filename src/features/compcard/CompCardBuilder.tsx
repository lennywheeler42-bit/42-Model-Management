"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, GripVertical, ImageUp, Minus, Plus, RotateCcw, X } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/Button";
import { CheckboxField, TextareaField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useMutation } from "@/lib/use-mutation";
import { frameToCrop, imageScale, MAX_ZOOM } from "@/features/media/crop";
import {
  BACK_LAYOUTS, DEFAULT_TAGLINE, FRONT_LAYOUTS, FRONT_LOGO_WIDTH, LOGO_HEIGHT, LOGO_MAX_WIDTH, MARGIN, NAME_TRACKING, PAGE, TEXT_LIMITS, THEMES,
  cardText, changeLayout, clearSlot, defaultDesign, designSchema, dropPhoto, findLayout, findTheme, logoSize, nameSize, swapSlots, trimText,
  type CardText, type Design, type Layout, type Placement, type Slot, type Stat, type Theme,
} from "./layout";

type Photo = { id: string; url: string; alt: string; public: boolean; cropped: boolean };
type Size = { width: number; height: number };
// The logo every comp card prints: an uploaded one, or the built-in 42 mark (null).
type Brand = { logoUrl: string | null; tagline: string };
const BUILT_IN_LOGO = "/brand/logo-mark-480.webp";

const PAGE_SIZE = 40;
const PHOTO_TYPE = "application/x-42-photo";
const SLOT_TYPE = "application/x-42-slot";

// Points on the card to a share of the page, so the preview scales with its width.
const pct = (value: number, of: number) => `${(value / of) * 100}%`;
const pt = (value: number) => `${(value / PAGE.width) * 100}cqw`;

// The center a frame can actually have: frameToCrop stops it at the photo's edge.
function settle(placement: Placement, imageAspect: number, slotAspect: number): Placement {
  const crop = frameToCrop(imageAspect, { aspect: slotAspect, zoom: placement.zoom, centerX: placement.centerX, centerY: placement.centerY });
  return { ...placement, centerX: crop.x + crop.width / 2, centerY: crop.y + crop.height / 2 };
}

// Comp card editor in the manner of CDS: choose a layout and theme, drag photos from
// the gallery onto the frames (or tap a photo, then a frame), drag a placed photo to
// move it inside its frame, zoom it, or drag its handle onto another frame to swap.
// The text on the card can be typed over, and the logo replaced (for every card).
export function CompCardBuilder({ talentId, name, location, photos, stats, measurementsAllowed, contact, brand, canEditBrand }: {
  talentId: string; name: string; location: string | null; photos: Photo[]; stats: Stat[]; measurementsAllowed: boolean; contact: string[];
  brand: Brand; canEditBrand: boolean;
}) {
  const storageKey = `compcard:${talentId}`;
  const byId = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);
  const fresh = () => defaultDesign(photos.map((photo) => photo.id), measurementsAllowed);
  const [design, setDesign] = useState<Design>(fresh);
  const [selected, setSelected] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const [websiteOnly, setWebsiteOnly] = useState(false);
  const [shown, setShown] = useState(PAGE_SIZE);
  // Saving starts only once the saved design has been read (state, not a ref, so the
  // default design of the first render is never written over the saved one).
  const [restored, setRestored] = useState(false);

  // The last design for this talent comes back on this computer, minus photos that
  // have since left the gallery.
  useEffect(() => {
    try {
      const saved = designSchema.safeParse(JSON.parse(window.localStorage.getItem(storageKey) ?? "null"));
      if (saved.success) {
        const slots = Object.fromEntries(Object.entries(saved.data.slots).filter(([, placement]) => byId.has(placement.photoId)));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off restore from browser storage after hydration
        setDesign({ ...saved.data, measurements: saved.data.measurements && measurementsAllowed, slots });
      }
    } catch { /* storage unavailable: start from the default */ }
    setRestored(true);
  }, [storageKey, byId, measurementsAllowed]);
  useEffect(() => {
    if (!restored) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(design)); } catch { /* not remembered */ }
  }, [design, storageKey, restored]);

  // The card's own text, and what it prints once staff have typed over any of it.
  const own = useMemo(() => ({ name, subtitle: location, stats, contact }), [name, location, stats, contact]);
  const text = cardText(design.text, own);
  const setText = (patch: CardText) => setDesign((current) => ({ ...current, text: { ...current.text, ...patch } }));
  const statRows = design.text?.stats ?? stats;
  const setStat = (index: number, patch: Partial<Stat>) => setText({ stats: statRows.map((stat, at) => (at === index ? { ...stat, ...patch } : stat)) });
  const textChanged = Boolean(trimText(design.text, own));

  const theme = findTheme(design.theme);
  const front = findLayout(FRONT_LAYOUTS, design.front);
  const back = findLayout(BACK_LAYOUTS, design.back);
  const used = new Set(Object.values(design.slots).map((placement) => placement.photoId));
  const listed = websiteOnly ? photos.filter((photo) => photo.public) : photos;
  const allSlots = [...front.slots, ...back.slots];
  const selectedSlot = allSlots.find((slot) => slot.id === selected) ?? null;
  const selectedPlacement = selected ? design.slots[selected] : undefined;
  // Only text that differs from the card's own travels with the design.
  const href = `/api/dashboard/talents/${talentId}/comp-card?design=${encodeURIComponent(JSON.stringify({ ...design, text: trimText(design.text, own) }))}`;
  const filled = allSlots.filter((slot) => design.slots[slot.id]).length;

  const aspectOf = (photoId: string) => { const size = sizes[photoId]; return size ? size.width / size.height : null; };
  const update = (slot: Slot, next: Placement) => {
    const aspect = aspectOf(next.photoId);
    setDesign((current) => ({ ...current, slots: { ...current.slots, [slot.id]: aspect ? settle(next, aspect, slot.width / slot.height) : next } }));
  };
  const zoomBy = (slot: Slot, step: number) => {
    const placement = design.slots[slot.id];
    if (placement) update(slot, { ...placement, zoom: Math.min(MAX_ZOOM, Math.max(1, Math.round((placement.zoom + step) * 100) / 100)) });
  };
  const place = (slotId: string, photoId: string) => { setDesign((current) => dropPhoto(current, slotId, photoId)); setSelected(slotId); setPicked(null); };

  if (!photos.length) return <div className="rounded-lg border border-[#e7e7e3] bg-white p-5 text-sm text-[#6b6d66]">Open the Media tab and add at least one photo to build a comp card.</div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-lg border border-[#e7e7e3] bg-white p-4">
      <LayoutPicker label="Front" layouts={FRONT_LAYOUTS} value={design.front} onChange={(key) => setDesign((current) => changeLayout(current, "front", key))} />
      <LayoutPicker label="Back" layouts={BACK_LAYOUTS} value={design.back} onChange={(key) => setDesign((current) => changeLayout(current, "back", key))} />
      <fieldset>
        <legend className="mb-2 text-[10px] font-800 uppercase tracking-[.14em] text-[#6b6d66]">Theme</legend>
        <div className="flex gap-2">{THEMES.map((option) => <button key={option.key} type="button" aria-pressed={option.key === theme.key} onClick={() => setDesign((current) => ({ ...current, theme: option.key }))}
          className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-[11px] font-700 ${option.key === theme.key ? "border-[#20211f] ring-1 ring-[#20211f]" : "border-[#e7e7e3] hover:border-[#20211f]"}`}>
          <span className="h-4 w-4 rounded-full ring-1 ring-black/15" style={{ background: option.paper }} aria-hidden />{option.label}
        </button>)}</div>
      </fieldset>
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <CheckboxField label="Measurements" name="measurements" checked={design.measurements} onChange={(value) => setDesign((current) => ({ ...current, measurements: value }))} disabled={!measurementsAllowed}
          hint={measurementsAllowed ? undefined : "Not public for this talent, so never printed."} />
        <Button variant="ghost" size="sm" icon={<RotateCcw size={13} aria-hidden />} onClick={() => { setDesign(fresh()); setSelected(null); }}>Reset</Button>
        {filled ? <a href={href} target="_blank" rel="noopener" className={buttonClass("primary")}><Download size={14} aria-hidden />Download PDF</a>
          : <span className={`${buttonClass("primary")} pointer-events-none opacity-50`} aria-disabled><Download size={14} aria-hidden />Download PDF</span>}
      </div>
    </div>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        <p className="text-xs text-[#6b6d66]">{picked ? "Now tap a frame on the card to place the photo." : "Drag photos from the gallery onto a frame. Drag a placed photo to move it inside its frame, scroll or use the slider to zoom, and drag the handle onto another frame to swap."}</p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {([["Front", front], ["Back", back]] as const).map(([side, layout]) => <figure key={side} className="min-w-0">
            <figcaption className="mb-2 text-[10px] font-800 uppercase tracking-[.14em] text-[#6b6d66]">{side}</figcaption>
            <div className="relative w-full overflow-hidden rounded-sm shadow-[0_8px_30px_rgba(0,0,0,.12)] ring-1 ring-black/10"
              style={{ aspectRatio: `${PAGE.width} / ${PAGE.height}`, background: theme.paper, color: theme.ink, containerType: "inline-size" }}>
              {layout.slots.map((slot) => <Frame key={slot.id} slot={slot} placement={design.slots[slot.id]} photo={design.slots[slot.id] ? byId.get(design.slots[slot.id].photoId) : undefined}
                size={design.slots[slot.id] ? sizes[design.slots[slot.id].photoId] : undefined} theme={theme} selected={selected === slot.id} over={over === slot.id} picking={Boolean(picked)}
                onSelect={() => picked ? place(slot.id, picked) : setSelected(slot.id)} onChange={(next) => update(slot, next)} onZoom={(step) => zoomBy(slot, step)}
                onClear={() => { setDesign((current) => clearSlot(current, slot.id)); setSelected(null); }}
                onLoad={(photoId, size) => setSizes((current) => current[photoId] ? current : { ...current, [photoId]: size })}
                onOver={(value) => setOver(value ? slot.id : null)}
                onDropPhoto={(photoId) => place(slot.id, photoId)} onDropSlot={(from) => { setDesign((current) => swapSlots(current, from, slot.id)); setSelected(slot.id); }} />)}
              {side === "Front" ? <FrontText name={text.name} subtitle={text.subtitle} layout={layout} theme={theme} brand={brand} />
                : <BackText stats={design.measurements && measurementsAllowed ? text.stats : []} contact={text.contact} layout={layout} theme={theme} brand={brand} />}
            </div>
          </figure>)}
        </div>
        {selectedSlot && selectedPlacement && <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#e7e7e3] bg-white px-4 py-3">
          <span className="text-[10px] font-800 uppercase tracking-[.14em] text-[#6b6d66]">Zoom</span>
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(selectedSlot, -0.1)} className="rounded border border-[#e7e7e3] p-1.5 hover:border-[#20211f]"><Minus size={13} /></button>
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={selectedPlacement.zoom} aria-label="Zoom" className="w-48 accent-[#20211f]"
            onChange={(event) => update(selectedSlot, { ...selectedPlacement, zoom: Number(event.target.value) })} />
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(selectedSlot, 0.1)} className="rounded border border-[#e7e7e3] p-1.5 hover:border-[#20211f]"><Plus size={13} /></button>
          <Button variant="ghost" size="sm" onClick={() => update(selectedSlot, { ...selectedPlacement, zoom: 1, centerX: 0.5, centerY: 0.5 })}>Fit</Button>
          <span className="text-xs text-[#6b6d66]">Arrow keys move the photo in its frame.</span>
        </div>}

        <section className="rounded-lg border border-[#e7e7e3] bg-white p-4" aria-label="Text on the card">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-sm font-800">Text on the card</h2>
            {textChanged && <Button variant="ghost" size="sm" icon={<RotateCcw size={13} aria-hidden />} onClick={() => setDesign((current) => ({ ...current, text: undefined }))}>Back to the talent&rsquo;s own text</Button>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Name" name="card_name" value={design.text?.name ?? name} onChange={(value) => setText({ name: value.slice(0, TEXT_LIMITS.name) })} hint="Printed in capitals on the front." />
            <TextField label="Line under the name" name="card_subtitle" value={design.text?.subtitle ?? location ?? ""} onChange={(value) => setText({ subtitle: value.slice(0, TEXT_LIMITS.subtitle) })} hint="Leave empty to print nothing." />
          </div>
          <fieldset className="mt-4" disabled={!measurementsAllowed || !design.measurements}>
            <legend className="text-[10px] font-800 uppercase tracking-[.14em] text-[#6f716b]">Stats on the back</legend>
            {!measurementsAllowed ? <p className="mt-2 text-xs text-[#6b6d66]">Not public for this talent, so never printed.</p>
              : !design.measurements ? <p className="mt-2 text-xs text-[#6b6d66]">Tick Measurements above to print and edit them.</p>
              : <>
                <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">{statRows.map((stat, index) => <li key={index} className="flex items-center gap-2">
                  <input aria-label={`Stat ${index + 1} label`} value={stat.label} maxLength={TEXT_LIMITS.statLabel} onChange={(event) => setStat(index, { label: event.target.value })}
                    className="w-24 min-w-0 rounded-md border border-[#dcdcd6] bg-white px-2.5 py-2 text-xs outline-none focus:border-[#a4502f]" />
                  <input aria-label={`Stat ${index + 1} value`} value={stat.value} maxLength={TEXT_LIMITS.statValue} onChange={(event) => setStat(index, { value: event.target.value })}
                    className="min-w-0 flex-1 rounded-md border border-[#dcdcd6] bg-white px-2.5 py-2 text-xs font-700 outline-none focus:border-[#a4502f]" />
                  <button type="button" aria-label={`Remove ${stat.label || "this stat"}`} onClick={() => setText({ stats: statRows.filter((_, at) => at !== index) })} className="rounded border border-[#e7e7e3] p-1.5 text-[#5f615b] hover:border-[#20211f]"><X size={12} /></button>
                </li>)}</ul>
                {statRows.length < TEXT_LIMITS.stats && <Button variant="ghost" size="sm" className="mt-2" icon={<Plus size={13} aria-hidden />} onClick={() => setText({ stats: [...statRows, { label: "", value: "" }] })}>Add a stat</Button>}
              </>}
          </fieldset>
          <TextareaField className="mt-4" label="Contact lines on the back" name="card_contact" rows={4} value={(design.text?.contact ?? contact).join("\n")}
            onChange={(value) => setText({ contact: value.split("\n").slice(0, TEXT_LIMITS.contactLines).map((entry) => entry.slice(0, TEXT_LIMITS.contactLine)) })}
            hint={`One per line, up to ${TEXT_LIMITS.contactLines}. The agency's details only, never a talent's own.`} />
          <p className="mt-3 text-xs text-[#6b6d66]">Changes are for this talent&rsquo;s card and are remembered on this computer.</p>
        </section>

        {canEditBrand && <LogoPanel brand={brand} />}
      </div>

      <aside className="min-w-0 rounded-lg border border-[#e7e7e3] bg-white p-4" aria-label="Gallery">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-800">Gallery</h2>
          <span className="text-xs text-[#6b6d66]">{photos.length} photo{photos.length === 1 ? "" : "s"}</span>
        </div>
        {photos.some((photo) => photo.public) && photos.some((photo) => !photo.public) && <div className="mb-3"><CheckboxField label="Only photos on the website" name="website_only" checked={websiteOnly} onChange={(value) => { setWebsiteOnly(value); setShown(PAGE_SIZE); }} /></div>}
        <ul className="grid max-h-[70vh] grid-cols-3 gap-2 overflow-y-auto pr-1">{listed.slice(0, shown).map((photo) => <li key={photo.id} className="relative">
          <button type="button" draggable aria-pressed={picked === photo.id} aria-label={`${photo.alt}: tap, then tap a frame`}
            onDragStart={(event) => { event.dataTransfer.setData(PHOTO_TYPE, photo.id); event.dataTransfer.effectAllowed = "copy"; setPicked(null); }}
            onClick={() => setPicked((current) => current === photo.id ? null : photo.id)}
            className={`block w-full cursor-grab overflow-hidden rounded-md ring-2 active:cursor-grabbing ${picked === photo.id ? "ring-[#a4502f]" : used.has(photo.id) ? "ring-[#20211f]/60" : "ring-transparent hover:ring-[#d6d6d0]"}`}>
            {/* Signed library thumbnail; next/image adds nothing in a picker grid. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" draggable={false} className="aspect-[3/4] w-full object-cover" loading="lazy" decoding="async"
              onLoad={(event) => { const { naturalWidth: width, naturalHeight: height } = event.currentTarget; setSizes((current) => current[photo.id] ? current : { ...current, [photo.id]: { width, height } }); }} />
          </button>
          <div className="pointer-events-none absolute bottom-1 left-1 flex flex-wrap gap-1">
            {used.has(photo.id) && <span className="rounded bg-[#20211f] px-1.5 py-0.5 text-[9px] font-800 text-white">On card</span>}
            {!photo.public && <span className="rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-800 text-[#5f615b]">Private</span>}
            {photo.cropped && <span className="rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-800 text-[#5f615b]">Cropped</span>}
          </div>
        </li>)}</ul>
        {listed.length > shown && <div className="mt-3 flex justify-center"><Button variant="secondary" size="sm" onClick={() => setShown((count) => count + PAGE_SIZE)}>Show more ({listed.length - shown} left)</Button></div>}
        <p className="mt-3 text-xs text-[#6b6d66]">Cropped photos print as you framed them in Media. Check that private photos are cleared before sending a card out.</p>
      </aside>
    </div>
  </div>;
}

function LayoutPicker({ label, layouts, value, onChange }: { label: string; layouts: Layout[]; value: string; onChange: (key: string) => void }) {
  return <fieldset>
    <legend className="mb-2 text-[10px] font-800 uppercase tracking-[.14em] text-[#6b6d66]">{label}</legend>
    <div className="flex gap-2">{layouts.map((layout) => <button key={layout.key} type="button" title={layout.label} aria-label={layout.label} aria-pressed={layout.key === value} onClick={() => onChange(layout.key)}
      className={`rounded-md border p-1 ${layout.key === value ? "border-[#20211f] ring-1 ring-[#20211f]" : "border-[#e7e7e3] hover:border-[#20211f]"}`}>
      <svg viewBox={`0 0 ${PAGE.width} ${PAGE.height}`} className="h-12 w-auto" aria-hidden>
        <rect width={PAGE.width} height={PAGE.height} fill="#fff" stroke="#d6d6d0" strokeWidth={8} />
        {layout.slots.map((slot) => <rect key={slot.id} x={slot.x} y={slot.y} width={slot.width} height={slot.height} fill={layout.key === value ? "#20211f" : "#b9b9b2"} />)}
      </svg>
    </button>)}</div>
  </fieldset>;
}

function Frame({ slot, placement, photo, size, theme, selected, over, picking, onSelect, onChange, onZoom, onClear, onLoad, onOver, onDropPhoto, onDropSlot }: {
  slot: Slot; placement?: Placement; photo?: Photo; size?: Size; theme: Theme; selected: boolean; over: boolean; picking: boolean;
  onSelect: () => void; onChange: (next: Placement) => void; onZoom: (step: number) => void; onClear: () => void; onLoad: (photoId: string, size: Size) => void;
  onOver: (value: boolean) => void; onDropPhoto: (photoId: string) => void; onDropSlot: (from: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; centerX: number; centerY: number } | null>(null);
  const slotAspect = slot.width / slot.height;
  const imageAspect = size ? size.width / size.height : null;
  const frame = placement && imageAspect ? { scale: imageScale(imageAspect, slotAspect, placement.zoom), crop: frameToCrop(imageAspect, { aspect: slotAspect, ...placement }) } : null;
  const accepts = (event: React.DragEvent) => event.dataTransfer.types.includes(PHOTO_TYPE) || event.dataTransfer.types.includes(SLOT_TYPE);

  // Scrolling over a placed photo zooms it rather than the page.
  useEffect(() => {
    const element = ref.current;
    if (!element || !placement) return;
    const wheel = (event: WheelEvent) => { event.preventDefault(); onZoom(event.deltaY < 0 ? 0.08 : -0.08); };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [placement, onZoom]);

  return <div ref={ref} role="button" tabIndex={0} aria-label={placement ? `Photo frame ${slot.id}: drag to move, arrow keys to adjust` : `Empty frame ${slot.id}`}
    className={`group absolute touch-none select-none overflow-hidden outline-none ${placement ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
    style={{ left: pct(slot.x, PAGE.width), top: pct(slot.y, PAGE.height), width: pct(slot.width, PAGE.width), height: pct(slot.height, PAGE.height), background: placement ? undefined : theme.key === "black" ? "#262523" : "#ecebe6" }}
    onClick={onSelect}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); return; }
      if (!placement || !frame) return;
      const step = 0.02;
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[event.key]) { event.preventDefault(); onChange({ ...placement, centerX: placement.centerX + moves[event.key][0] * frame.crop.width, centerY: placement.centerY + moves[event.key][1] * frame.crop.height }); }
      if (event.key === "+" || event.key === "=") onZoom(0.1);
      if (event.key === "-") onZoom(-0.1);
      if (event.key === "Delete" || event.key === "Backspace") onClear();
    }}
    onPointerDown={(event) => {
      if (!placement || picking || (event.target as HTMLElement).closest("[data-control]")) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { x: event.clientX, y: event.clientY, centerX: placement.centerX, centerY: placement.centerY };
    }}
    onPointerMove={(event) => {
      if (!drag.current || !placement || !frame) return;
      const { clientWidth, clientHeight } = event.currentTarget;
      onChange({ ...placement, centerX: drag.current.centerX - (event.clientX - drag.current.x) / (clientWidth * frame.scale.width), centerY: drag.current.centerY - (event.clientY - drag.current.y) / (clientHeight * frame.scale.height) });
    }}
    onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
    onDragOver={(event) => { if (!accepts(event)) return; event.preventDefault(); event.dataTransfer.dropEffect = event.dataTransfer.types.includes(SLOT_TYPE) ? "move" : "copy"; onOver(true); }}
    onDragLeave={() => onOver(false)}
    onDrop={(event) => {
      event.preventDefault(); onOver(false);
      const photoId = event.dataTransfer.getData(PHOTO_TYPE);
      const from = event.dataTransfer.getData(SLOT_TYPE);
      if (photoId) onDropPhoto(photoId); else if (from) onDropSlot(from);
    }}>
    {placement && photo && <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt="" draggable={false} className="pointer-events-none absolute max-w-none"
        onLoad={(event) => onLoad(photo.id, { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
        style={frame ? { width: `${frame.scale.width * 100}%`, height: `${frame.scale.height * 100}%`, left: `${-frame.crop.x * frame.scale.width * 100}%`, top: `${-frame.crop.y * frame.scale.height * 100}%` } : { inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div data-control className={`absolute right-1 top-1 flex gap-1 transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
        <span draggable role="img" aria-label="Drag onto another frame to swap" title="Drag onto another frame to swap"
          onDragStart={(event) => { event.dataTransfer.setData(SLOT_TYPE, slot.id); event.dataTransfer.effectAllowed = "move"; }}
          className="cursor-move rounded bg-white/90 p-1 text-[#20211f] shadow"><GripVertical size={12} /></span>
        <button type="button" aria-label="Remove photo from frame" onClick={(event) => { event.stopPropagation(); onClear(); }} className="rounded bg-white/90 p-1 text-[#20211f] shadow hover:text-[#a9593d]"><X size={12} /></button>
      </div>
    </>}
    {!placement && <span className="pointer-events-none absolute inset-0 flex items-center justify-center p-2 text-center text-[10px] font-700 uppercase tracking-[.12em]" style={{ color: theme.muted }}>{picking ? "Tap to place" : "Drop photo"}</span>}
    <span aria-hidden className={`pointer-events-none absolute inset-0 ${over ? "bg-[#a4502f]/25 ring-2 ring-inset ring-[#a4502f]" : selected ? "ring-2 ring-inset ring-[#a4502f]" : picking ? "ring-2 ring-inset ring-dashed ring-[#a4502f]/60" : ""}`} />
  </div>;
}

// The logo as the card prints it: fitted into the same box as in the PDF (logoSize).
function Logo({ brand }: { brand: Brand }) {
  const [size, setSize] = useState<Size | null>(null);
  const fitted = size ? logoSize(size.width, size.height) : null;
  return <div className="flex flex-col items-center">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={brand.logoUrl ?? BUILT_IN_LOGO} alt="Logo" onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
      style={fitted ? { width: pt(fitted.width), height: pt(fitted.height) } : { maxHeight: pt(LOGO_HEIGHT), maxWidth: pt(LOGO_MAX_WIDTH), width: "auto", height: "auto" }} />
    {brand.tagline.trim() && <span className="whitespace-nowrap font-800 uppercase leading-none" style={{ fontSize: pt(6), letterSpacing: pt(2.2), marginTop: pt(2) }}>{brand.tagline.trim()}</span>}
  </div>;
}

// Replace the logo on every comp card: drop an image, or choose one. Only for staff
// who manage settings; everyone else just sees the logo on the card.
function LogoPanel({ brand }: { brand: Brand }) {
  const toast = useToast();
  const { run, pending } = useMutation();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tagline, setTagline] = useState(brand.tagline);
  const custom = Boolean(brand.logoUrl) || brand.tagline !== DEFAULT_TAGLINE;

  async function upload(file: File | undefined) {
    if (!file || uploading) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { toast.error("Use a PNG, JPEG or WebP image."); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error("That file is too large. Use an image under 4 MB."); return; }
    setUploading(true);
    try {
      const response = await fetch("/api/dashboard/comp-card/logo", { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const body = await response.json().catch(() => null);
      if (!response.ok) { toast.error(body?.error ?? "The logo could not be saved."); return; }
      toast.success("Logo changed on every comp card");
      window.location.reload();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return <section className="rounded-lg border border-[#e7e7e3] bg-white p-4" aria-label="Logo">
    <h2 className="text-sm font-800">Logo</h2>
    <p className="mt-1 text-xs text-[#6b6d66]">Printed on both sides of every comp card, for every talent.</p>
    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div role="button" tabIndex={0} aria-label="Drop a new logo here, or press Enter to choose a file"
        onClick={() => input.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); input.current?.click(); } }}
        onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)}
        onDrop={(event) => { event.preventDefault(); setOver(false); void upload(event.dataTransfer.files[0]); }}
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-5 text-center outline-none focus-visible:border-[#a4502f] ${over ? "border-[#a4502f] bg-[#fbf3ee]" : "border-[#d6d6d0] hover:border-[#20211f]"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brand.logoUrl ?? BUILT_IN_LOGO} alt="Current logo" className="max-h-14 max-w-[70%] object-contain" />
        <span className="inline-flex items-center gap-1.5 text-[11px] font-700 text-[#3d3f3a]"><ImageUp size={13} aria-hidden />{uploading ? "Uploading…" : "Drop a new logo here, or click to choose"}</span>
        <span className="text-[11px] text-[#6b6d66]">PNG, JPEG or WebP, under 4 MB. A PNG with a clear background prints best.</span>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
      </div>
      <div className="space-y-3">
        <TextField label="Line under the logo" name="tagline" value={tagline} onChange={(value) => setTagline(value.slice(0, TEXT_LIMITS.tagline))} hint="Leave empty if the logo already says it." />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={pending || tagline.trim() === brand.tagline.trim()} onClick={() => run("/api/dashboard/comp-card/logo", { method: "PUT", body: { tagline }, success: "Saved" })}>Save line</Button>
          {custom && <Button size="sm" variant="ghost" icon={<RotateCcw size={13} aria-hidden />} disabled={pending || uploading}
            onClick={async () => { if (window.confirm("Go back to the 42 logo and \"Model Management\" on every comp card?") && await run("/api/dashboard/comp-card/logo", { method: "DELETE", success: "Back to the 42 logo", refresh: false })) window.location.reload(); }}>Use the 42 logo</Button>}
        </div>
      </div>
    </div>
  </section>;
}

function FrontText({ name, subtitle, layout, theme, brand }: { name: string; subtitle: string; layout: Layout; theme: Theme; brand: Brand }) {
  const bottom = Math.max(...layout.slots.map((slot) => slot.y + slot.height));
  const nameWidth = PAGE.width - MARGIN * 2 - FRONT_LOGO_WIDTH - 12;
  return <div className="pointer-events-none absolute flex items-center justify-between"
    style={{ left: pct(MARGIN, PAGE.width), right: pct(MARGIN, PAGE.width), top: pct(bottom + 10, PAGE.height), bottom: pct(14, PAGE.height) }}>
    <div style={{ width: pt(nameWidth) }} className="min-w-0">
      <p className="whitespace-nowrap font-800 uppercase leading-none" style={{ fontSize: pt(nameSize(name, nameWidth)), letterSpacing: pt(NAME_TRACKING) }}>{name}</p>
      {subtitle && <p className="truncate uppercase" style={{ fontSize: pt(7), letterSpacing: pt(1.4), marginTop: pt(4), color: theme.muted }}>{subtitle}</p>}
    </div>
    <Logo brand={brand} />
  </div>;
}

function BackText({ stats, contact, layout, theme, brand }: { stats: Stat[]; contact: string[]; layout: Layout; theme: Theme; brand: Brand }) {
  const bottom = Math.max(...layout.slots.map((slot) => slot.y + slot.height));
  return <>
    {stats.length > 0 && <div className="pointer-events-none absolute flex flex-wrap border-t"
      style={{ left: pct(MARGIN, PAGE.width), right: pct(MARGIN, PAGE.width), top: pct(bottom + 12, PAGE.height), borderColor: theme.rule, paddingTop: pt(8), columnGap: pt(14), rowGap: pt(6) }}>
      {stats.map((stat, index) => <div key={`${stat.label}-${index}`}>
        <p className="uppercase" style={{ fontSize: pt(6), letterSpacing: pt(1.2), color: theme.muted }}>{stat.label}</p>
        <p className="font-800" style={{ fontSize: pt(9) }}>{stat.value}</p>
      </div>)}
    </div>}
    <div className="pointer-events-none absolute flex items-end justify-between" style={{ left: pct(MARGIN, PAGE.width), right: pct(MARGIN, PAGE.width), bottom: pct(16, PAGE.height) }}>
      <Logo brand={brand} />
      <div className="text-right" style={{ fontSize: pt(7), lineHeight: 1.5 }}>{contact.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div>
    </div>
  </>;
}
