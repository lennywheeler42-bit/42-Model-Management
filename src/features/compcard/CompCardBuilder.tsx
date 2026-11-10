"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, GripVertical, Minus, Plus, RotateCcw, X } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/Field";
import { frameToCrop, imageScale, MAX_ZOOM } from "@/features/media/crop";
import {
  BACK_LAYOUTS, FRONT_LAYOUTS, FRONT_LOGO_WIDTH, LOGO_HEIGHT, MARGIN, NAME_TRACKING, PAGE, THEMES,
  changeLayout, clearSlot, defaultDesign, designSchema, dropPhoto, findLayout, findTheme, nameSize, swapSlots,
  type Design, type Layout, type Placement, type Slot, type Theme,
} from "./layout";

type Photo = { id: string; url: string; alt: string; public: boolean; cropped: boolean };
type Size = { width: number; height: number };

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
export function CompCardBuilder({ talentId, name, location, photos, stats, measurementsAllowed, contact }: {
  talentId: string; name: string; location: string | null; photos: Photo[]; stats: { label: string; value: string }[]; measurementsAllowed: boolean; contact: string[];
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

  const theme = findTheme(design.theme);
  const front = findLayout(FRONT_LAYOUTS, design.front);
  const back = findLayout(BACK_LAYOUTS, design.back);
  const used = new Set(Object.values(design.slots).map((placement) => placement.photoId));
  const listed = websiteOnly ? photos.filter((photo) => photo.public) : photos;
  const allSlots = [...front.slots, ...back.slots];
  const selectedSlot = allSlots.find((slot) => slot.id === selected) ?? null;
  const selectedPlacement = selected ? design.slots[selected] : undefined;
  const href = `/api/dashboard/talents/${talentId}/comp-card?design=${encodeURIComponent(JSON.stringify(design))}`;
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
              {side === "Front" ? <FrontText name={name} location={location} layout={layout} theme={theme} /> : <BackText stats={design.measurements ? stats : []} contact={contact} layout={layout} theme={theme} />}
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

function Logo() {
  return <div className="flex flex-col items-center">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/brand/logo-mark-480.webp" alt="42 Model Management" style={{ height: pt(LOGO_HEIGHT), width: "auto" }} />
    <span className="whitespace-nowrap font-800 uppercase leading-none" style={{ fontSize: pt(6), letterSpacing: pt(2.2), marginTop: pt(2) }}>Model Management</span>
  </div>;
}

function FrontText({ name, location, layout, theme }: { name: string; location: string | null; layout: Layout; theme: Theme }) {
  const bottom = Math.max(...layout.slots.map((slot) => slot.y + slot.height));
  const nameWidth = PAGE.width - MARGIN * 2 - FRONT_LOGO_WIDTH - 12;
  return <div className="pointer-events-none absolute flex items-center justify-between"
    style={{ left: pct(MARGIN, PAGE.width), right: pct(MARGIN, PAGE.width), top: pct(bottom + 10, PAGE.height), bottom: pct(14, PAGE.height) }}>
    <div style={{ width: pt(nameWidth) }} className="min-w-0">
      <p className="whitespace-nowrap font-800 uppercase leading-none" style={{ fontSize: pt(nameSize(name, nameWidth)), letterSpacing: pt(NAME_TRACKING) }}>{name}</p>
      {location && <p className="truncate uppercase" style={{ fontSize: pt(7), letterSpacing: pt(1.4), marginTop: pt(4), color: theme.muted }}>{location}</p>}
    </div>
    <Logo />
  </div>;
}

function BackText({ stats, contact, layout, theme }: { stats: { label: string; value: string }[]; contact: string[]; layout: Layout; theme: Theme }) {
  const bottom = Math.max(...layout.slots.map((slot) => slot.y + slot.height));
  return <>
    {stats.length > 0 && <div className="pointer-events-none absolute flex flex-wrap border-t"
      style={{ left: pct(MARGIN, PAGE.width), right: pct(MARGIN, PAGE.width), top: pct(bottom + 12, PAGE.height), borderColor: theme.rule, paddingTop: pt(8), columnGap: pt(14), rowGap: pt(6) }}>
      {stats.map((stat) => <div key={stat.label}>
        <p className="uppercase" style={{ fontSize: pt(6), letterSpacing: pt(1.2), color: theme.muted }}>{stat.label}</p>
        <p className="font-800" style={{ fontSize: pt(9) }}>{stat.value}</p>
      </div>)}
    </div>}
    <div className="pointer-events-none absolute flex items-end justify-between" style={{ left: pct(MARGIN, PAGE.width), right: pct(MARGIN, PAGE.width), bottom: pct(16, PAGE.height) }}>
      <Logo />
      <div className="text-right" style={{ fontSize: pt(7), lineHeight: 1.5 }}>{contact.map((line) => <p key={line}>{line}</p>)}</div>
    </div>
  </>;
}
