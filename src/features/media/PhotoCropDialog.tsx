"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useMutation } from "@/lib/use-mutation";
import { CROP_ASPECTS, MAX_ZOOM, cropToFrame, frameToCrop, imageScale, type Crop, type Frame } from "./crop";

type SavedCrop = Crop & { aspect: string };

// Drag to reposition, slider or wheel to zoom, pick a shape. Nothing changes the
// original: the server cuts a separate cropped file from it (.../crop/route.ts).
export function PhotoCropDialog({ talentId, photoId, onClose }: { talentId: string; photoId: string; onClose: () => void }) {
  const { run, pending } = useMutation();
  const toast = useToast();
  const base = `/api/dashboard/talents/${talentId}/media/${photoId}/crop`;
  const [source, setSource] = useState<{ url: string; saved: SavedCrop | null } | null>(null);
  const [imageAspect, setImageAspect] = useState(0);
  const [aspectKey, setAspectKey] = useState<string>(CROP_ASPECTS[0].key);
  const [frame, setFrame] = useState<Frame | null>(null);
  const frameElement = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; centerX: number; centerY: number } | null>(null);

  useEffect(() => {
    let current = true;
    fetch(base).then((response) => response.ok ? response.json() : Promise.reject(new Error("load failed")))
      .then((payload: { url: string; crop: SavedCrop | null }) => { if (current) setSource({ url: payload.url, saved: payload.crop }); })
      .catch(() => { if (current) { toast.error("The photo could not be opened."); onClose(); } });
    return () => { current = false; };
  }, [base, onClose, toast]);

  const ratioOf = (key: string) => CROP_ASPECTS.find((aspect) => aspect.key === key)?.ratio ?? CROP_ASPECTS[0].ratio;

  function imageLoaded(image: HTMLImageElement) {
    const aspect = image.naturalWidth / image.naturalHeight;
    setImageAspect(aspect);
    const saved = source?.saved;
    if (saved) {
      setAspectKey(saved.aspect);
      setFrame(cropToFrame(aspect, ratioOf(saved.aspect), saved));
    } else setFrame({ aspect: ratioOf(aspectKey), zoom: 1, centerX: 0.5, centerY: 0.5 });
  }

  // Keeps the photo covering the frame: what is stored is always what the crop shows.
  const settle = (next: Frame): Frame => {
    const crop = frameToCrop(imageAspect, next);
    return { ...next, centerX: crop.x + crop.width / 2, centerY: crop.y + crop.height / 2 };
  };

  function pointerMove(event: React.PointerEvent) {
    if (!drag.current || !frame || !frameElement.current) return;
    const scale = imageScale(imageAspect, frame.aspect, frame.zoom);
    const { clientWidth, clientHeight } = frameElement.current;
    const { x, y, centerX, centerY } = drag.current;
    setFrame(settle({ ...frame, centerX: centerX - (event.clientX - x) / (clientWidth * scale.width), centerY: centerY - (event.clientY - y) / (clientHeight * scale.height) }));
  }

  const zoomTo = (zoom: number) => frame && setFrame(settle({ ...frame, zoom: Math.min(MAX_ZOOM, Math.max(1, zoom)) }));

  async function save() {
    if (!frame) return;
    const saved = await run(base, { body: { ...frameToCrop(imageAspect, frame), aspect: aspectKey }, success: "Crop saved. The original is unchanged." });
    if (saved) onClose();
  }

  async function reset() {
    const saved = await run(base, { method: "DELETE", success: "Back to the full photo" });
    if (saved) onClose();
  }

  const crop = frame && frameToCrop(imageAspect, frame);
  const scale = frame && imageScale(imageAspect, frame.aspect, frame.zoom);

  return <Dialog open onClose={onClose} title="Crop photo" description="Drag to reposition and use the slider to zoom. The original is kept unchanged." wide
    footer={<>
      {source?.saved && <Button variant="ghost" disabled={pending} onClick={reset}>Remove crop</Button>}
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button disabled={pending || !frame} onClick={save}>{pending ? "Saving…" : "Save crop"}</Button>
    </>}>
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Crop shape">{CROP_ASPECTS.map((aspect) => <button key={aspect.key} type="button" aria-pressed={aspectKey === aspect.key}
        onClick={() => { setAspectKey(aspect.key); if (frame) setFrame(settle({ ...frame, aspect: aspect.ratio })); }}
        className={`rounded-full border px-3 py-1 text-xs font-700 ${aspectKey === aspect.key ? "border-[#20211f] bg-[#20211f] text-white" : "border-[#dcdcd6] text-[#5f615b] hover:border-[#20211f]"}`}>{aspect.label}</button>)}</div>

      <div className="flex justify-center bg-[#f3f3f0] p-3">
        <div ref={frameElement} className="relative touch-none select-none overflow-hidden bg-[#20211f] active:cursor-grabbing"
          style={{ aspectRatio: frame ? frame.aspect : ratioOf(aspectKey), height: "min(52vh, 460px)", maxWidth: "100%", cursor: "grab" }}
          onPointerDown={(event) => { if (!frame) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, centerX: frame.centerX, centerY: frame.centerY }; }}
          onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
          onWheel={(event) => frame && zoomTo(frame.zoom - event.deltaY / 500)}>
          {source && /* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link to the private original */
            <img src={source.url} alt="Photo being cropped" draggable={false} onLoad={(event) => imageLoaded(event.currentTarget)}
              className="absolute max-w-none"
              style={crop && scale ? { width: `${scale.width * 100}%`, height: `${scale.height * 100}%`, left: `${-crop.x * scale.width * 100}%`, top: `${-crop.y * scale.height * 100}%` } : { visibility: "hidden" }} />}
          {!frame && <p className="absolute inset-0 grid place-items-center text-xs text-white/80">Opening the full photo…</p>}
          {frame && <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3" aria-hidden>{Array.from({ length: 9 }, (_, index) => <span key={index} className="border border-white/25" />)}</div>}
        </div>
      </div>

      <label className="flex items-center gap-3 text-xs font-700 text-[#5f615b]">Zoom
        <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={frame?.zoom ?? 1} disabled={!frame} onChange={(event) => zoomTo(Number(event.target.value))} className="min-w-0 flex-1 accent-[#a4502f]" />
      </label>
    </div>
  </Dialog>;
}
