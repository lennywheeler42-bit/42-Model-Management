"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe2, Square } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/Field";
import { Card } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { WEBSITE_LABELS, bulkTargets, checkWebsite, type WebsiteRow } from "../website";

type Filter = "all" | "live" | "off" | "no_photo";
type Progress = { index: number; total: number; name: string; photos: number };
type Outcome = { shown: number; photos: number; failed: { name: string; reason: string }[]; stopped: boolean };

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Everyone" }, { key: "live", label: "On the website" }, { key: "off", label: "Not shown" }, { key: "no_photo", label: "No photo" },
];

async function post(url: string) {
  try {
    const response = await fetch(url, { method: "POST" });
    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    return response.ok ? { ok: true as const, body: body ?? {} } : { ok: false as const, error: typeof body?.error === "string" ? body.error : "The change could not be saved." };
  } catch {
    return { ok: false as const, error: "Network error" };
  }
}

// Shows where every talent stands with the website, and puts everyone who has photos
// on it: their approved photos first, then their portfolios, then the profile itself.
// Runs one talent at a time from this page, so it can be stopped and run again; what
// is already on the website is left as it is.
export function WebsiteCheck({ rows, canPublish }: { rows: WebsiteRow[]; canPublish: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [minors, setMinors] = useState(false);
  const [livePhotos, setLivePhotos] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const stop = useRef(false);

  const checked = useMemo(() => rows.map((row) => ({ row, check: checkWebsite(row) })), [rows]);
  const live = checked.filter(({ check }) => check.state === "live");
  const noPhoto = checked.filter(({ row }) => row.counts.approved === 0);
  const ready = bulkTargets(rows, { includeMinorsWithoutConsent: true });
  const waitingConsent = checked.filter(({ check }) => check.ready && check.needsConsent);
  const liveWithPrivate = live.filter(({ row }) => row.counts.approved > row.counts.website);
  const targets = [...bulkTargets(rows, { includeMinorsWithoutConsent: minors }), ...(livePhotos ? liveWithPrivate.map(({ row }) => row) : [])];
  const listed = checked.filter(({ row, check }) => filter === "all" || (filter === "live" ? check.state === "live" : filter === "no_photo" ? row.counts.approved === 0 : check.state !== "live"));

  async function showOne(row: WebsiteRow, report: (photos: number) => void) {
    let photos = 0;
    // A large book takes several calls: each reports how many photos are left.
    for (let round = 0; round < 80 && !stop.current; round += 1) {
      const result = await post(`/api/dashboard/talents/${row.id}/media/publish-all`);
      if (!result.ok) return { photos, error: result.error };
      const published = Number(result.body.published) || 0;
      photos += published;
      report(photos);
      if (!Number(result.body.remaining) || !published) break;
    }
    if (stop.current) return { photos, stopped: true };
    const result = await post(`/api/dashboard/talents/${row.id}/website`);
    return result.ok ? { photos } : { photos, error: result.error };
  }

  async function run() {
    if (!targets.length || progress) return;
    if (!window.confirm(`Show ${targets.length} talent on the website?\n\nTheir approved photos and portfolios become public and their profiles are published. Talent with no photo are skipped. You can unpublish anyone afterwards from their page.`)) return;
    stop.current = false;
    setOutcome(null);
    const result: Outcome = { shown: 0, photos: 0, failed: [], stopped: false };
    for (const [index, row] of targets.entries()) {
      if (stop.current) { result.stopped = true; break; }
      setProgress({ index: index + 1, total: targets.length, name: row.display_name, photos: 0 });
      const one = await showOne(row, (photos) => setProgress({ index: index + 1, total: targets.length, name: row.display_name, photos }));
      result.photos += one.photos;
      if ("stopped" in one) { result.stopped = true; break; }
      if ("error" in one && one.error) result.failed.push({ name: row.display_name, reason: one.error }); else result.shown += 1;
    }
    setProgress(null);
    setOutcome(result);
    if (result.failed.length) toast.error(`${result.failed.length} talent could not be shown. See the list below.`);
    else toast.success(result.stopped ? "Stopped. Run it again to carry on." : `${result.shown} talent are now on the website`);
    router.refresh();
  }

  const tiles: { label: string; value: number; tone: string }[] = [
    { label: "On the website", value: live.length, tone: "text-[#4f7a54]" },
    { label: "Ready to show", value: ready.length, tone: "text-[#20211f]" },
    { label: "No photo", value: noPhoto.length, tone: noPhoto.length ? "text-[#b3261e]" : "text-[#20211f]" },
    { label: "Active talent", value: rows.length, tone: "text-[#20211f]" },
  ];

  return <div className="space-y-6">
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{tiles.map((tile) => <div key={tile.label} className="rounded-xl border border-[#e7e7e3] bg-white px-4 py-4">
      <dt className="text-[10px] font-800 uppercase tracking-[.14em] text-[#6b6d66]">{tile.label}</dt>
      <dd className={`mt-1 text-3xl font-700 tracking-[-.03em] ${tile.tone}`}>{tile.value}</dd>
    </div>)}</dl>

    {canPublish && <Card title="Show everyone with photos" description="Puts every talent who has photos on the website: their approved photos and portfolios become public and their profile is published. Talent with no photo are skipped and stay marked No photo.">
      <div className="space-y-4 text-sm">
        {waitingConsent.length > 0 && <CheckboxField label={`Include ${waitingConsent.length} minor${waitingConsent.length === 1 ? "" : "s"} without recorded guardian consent`} name="minors" checked={minors} onChange={setMinors} disabled={Boolean(progress)}
          hint="Left out unless you tick this. Record consent on the talent's page, or tick this if you hold it on file." />}
        {liveWithPrivate.length > 0 && <CheckboxField label={`Also show the private photos of ${liveWithPrivate.length} talent already on the website`} name="live_photos" checked={livePhotos} onChange={setLivePhotos} disabled={Boolean(progress)}
          hint="Their profiles are live with the photos staff chose. Tick this to show their whole approved gallery as well." />}
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={<Globe2 size={14} aria-hidden />} disabled={Boolean(progress) || !targets.length} onClick={run}>{progress ? "Working…" : `Show ${targets.length} talent on the website`}</Button>
          {progress && <Button variant="secondary" icon={<Square size={12} aria-hidden />} onClick={() => { stop.current = true; }}>Stop</Button>}
          {!targets.length && !progress && <span className="text-xs text-[#6b6d66]">Everyone with photos is already on the website.</span>}
        </div>
        {progress && <div role="status" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-[#efefeb]"><div className="h-full bg-[#20211f] transition-[width]" style={{ width: `${((progress.index - 1) / progress.total) * 100}%` }} /></div>
          <p className="mt-2 text-xs text-[#6b6d66]">{progress.index} of {progress.total}: {progress.name}{progress.photos ? ` · ${progress.photos} photo${progress.photos === 1 ? "" : "s"} shown` : ""}. Keep this page open until it finishes.</p>
        </div>}
        {outcome && <div className="rounded-md border border-[#e7e7e3] bg-[#fafaf8] px-3 py-3 text-xs leading-5">
          <p className="font-700">{outcome.shown} talent shown, {outcome.photos} photo{outcome.photos === 1 ? "" : "s"} added to the website{outcome.stopped ? " (stopped early)" : ""}.</p>
          {outcome.failed.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[#b3261e]">{outcome.failed.map((item) => <li key={item.name}>{item.name}: {item.reason}</li>)}</ul>}
        </div>}
      </div>
    </Card>}

    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">{FILTERS.map((item) => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}
      className={`rounded-full border px-3 py-1.5 text-[10px] font-800 uppercase tracking-[.12em] ${filter === item.key ? "border-[#20211f] bg-[#20211f] text-white" : "border-[#dcdcd6] bg-white text-[#5f615b] hover:border-[#20211f]"}`}>{item.label}</button>)}</div>

    <div className="relative overflow-x-auto rounded-xl border border-[#e7e7e3] bg-white">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">Website status of every active talent</caption>
        <thead><tr className="border-b border-[#efefeb] text-[9px] font-800 uppercase tracking-[.14em] text-[#6b6d66]">
          <th scope="col" className="px-4 py-3">Talent</th><th scope="col" className="px-4 py-3">Website</th><th scope="col" className="px-4 py-3">Photos on website</th><th scope="col" className="px-4 py-3">To do</th>
        </tr></thead>
        <tbody>{listed.map(({ row, check }) => <tr key={row.id} className="border-b border-[#f3f3f0] last:border-0 hover:bg-[#fafaf8]">
          <td className="px-4 py-3"><Link href={`/dashboard/talent/${row.id}?tab=media`} className="font-700 hover:text-[#a4502f]">{row.display_name}</Link>{row.is_minor && <span className="ml-2 text-[10px] uppercase tracking-[.08em] text-[#8a8c84]">Minor</span>}</td>
          <td className="px-4 py-3">{row.counts.approved === 0 ? <Badge tone="danger">No photo</Badge> : <Badge tone={WEBSITE_LABELS[check.state].tone}>{check.state === "hidden" ? "Not shown" : WEBSITE_LABELS[check.state].label}</Badge>}</td>
          <td className="px-4 py-3 text-xs text-[#5f615b]">{row.counts.website} of {row.counts.approved}</td>
          <td className="px-4 py-3 text-xs text-[#5f615b]">{check.notes.length ? check.notes.join(" · ") : check.state === "live" ? "—" : "Ready to show"}</td>
        </tr>)}</tbody>
      </table>
      {!listed.length && <p className="px-4 py-8 text-center text-sm text-[#6b6d66]">Nobody in this group.</p>}
    </div>
  </div>;
}
