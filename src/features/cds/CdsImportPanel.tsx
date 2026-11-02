"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type VerifyRow = { cdsId: string; name: string; talentId: string | null; status: string; note: string | null; listed: number; verified: number; duplicates: number; waiting: number; failed: number; missingFile: number; wrongTalent: number; thumbnails: number; bytes: number };
const VERIFY_BATCH = 8;
const gigabytes = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(2)} GB`;
// Longer than the server's own 60-second limit, shorter than the reader's 180-second wait.
const REQUEST_TIMEOUT_MS = 90_000;

// Origins allowed to hand data to this page (the owner's own CDS / WebForFashion
// windows, opened from here). Everything is validated again on the server.
const SOURCES = new Set(["https://app.webforfashion.com", "https://go.cdsglobal.com"]);
const WINDOWS = {
  cds: { url: "https://go.cdsglobal.com/Talent.aspx", name: "cds-source", label: "CDS" },
  wff: { url: "https://app.webforfashion.com/talent/search", name: "wff-source", label: "WebForFashion" },
};

type Line = { at: string; text: string; tone: "ok" | "error" | "info" };

// Steps 1 and 2 receive data from CDS and WebForFashion windows opened from here,
// by postMessage (no files are downloaded): { type: "cds-import/batch",
// requestId, payload: { talents?, wff? } } — the body of /api/dashboard/cds/ingest.
// Step 3 adds the talents not yet in the dashboard. Step 4 (photos) runs from the
// WebForFashion window too: { plan | photos | finish } go to /api/dashboard/cds/photos.
export function CdsImportPanel({ pending }: { pending: number }) {
  const router = useRouter();
  const toast = useToast();
  const [lines, setLines] = useState<Line[]>([]);
  const [received, setReceived] = useState(0);
  const [applying, setApplying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<VerifyRow[] | null>(null);
  const [verifyTotal, setVerifyTotal] = useState(0);
  const queue = useRef(Promise.resolve());

  const note = (text: string, tone: Line["tone"] = "info") =>
    setLines((current) => [{ at: new Date().toLocaleTimeString(), text, tone }, ...current].slice(0, 200));

  useEffect(() => {
    // Keeps the line moving whatever one job does.
    const enqueue = (job: () => Promise<void>) => { queue.current = queue.current.then(job).catch((error) => console.error("CDS import step failed", error)); };
    function onMessage(event: MessageEvent) {
      if (!SOURCES.has(event.origin) || typeof event.data !== "object" || !event.data) return;
      const reply = (message: Record<string, unknown>) => (event.source as Window | null)?.postMessage(message, event.origin);
      if (event.data.type === "cds-import/hello") { reply({ type: "cds-import/ready" }); return; }
      if (event.data.type !== "cds-import/batch" || typeof event.data.payload !== "object" || !event.data.payload) return;
      const payload = event.data.payload as { talents?: { first_name?: string; last_name?: string }[]; wff?: { first_name?: string; last_name?: string }[]; plan?: true; photos?: unknown[]; finish?: string; name?: string };
      const talents = [...(payload.talents ?? []), ...(payload.wff ?? [])];
      const requestId = event.data.requestId;
      // Photo copy (step 4): plan, copy a few photos, or finish one talent.
      if (payload.plan || payload.photos || payload.finish) {
        enqueue(async () => {
          const body = payload.plan ? { plan: true } : payload.photos ? { photos: payload.photos } : { finish: payload.finish };
          // A request that never returns must not hold up everything behind it.
          const response = await fetch("/api/dashboard/cds/photos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).catch(() => null);
          const result = response ? await response.json().catch(() => ({})) : { error: "No answer in time" };
          if (!response?.ok) note(`Photo copy: ${result.error ?? "error"}`, "error");
          else if (payload.plan) note(`Photo copy: ${result.selected} photos selected for ${result.talents.length} talents; ${result.imported} already copied`, "ok");
          else if (payload.photos) {
            setReceived((count) => count + (result.imported ?? 0) + (result.upgraded ?? 0));
            if (result.failed) note(`Photo copy: ${result.failed} could not be copied (${(result.errors ?? []).slice(0, 2).join("; ")})`, "error");
          } else note(`Photos ready for ${payload.name ?? payload.finish}: ${result.cover ? "profile picture set, " : ""}${result.portfolios} portfolios`, "ok");
          reply({ type: "cds-import/ack", requestId, ok: Boolean(response?.ok), error: response?.ok ? null : result.error ?? "error", result });
        });
        return;
      }
      // One batch at a time, in arrival order.
      enqueue(async () => {
        const response = await fetch("/api/dashboard/cds/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).catch(() => null);
        const result = response ? await response.json().catch(() => ({})) : { error: "No answer in time" };
        const names = talents.map((t) => `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim()).join(", ");
        if (response?.ok) {
          setReceived((count) => count + talents.length);
          note(`Saved ${names}${payload.wff ? ` (${result.media ?? 0} photos listed)` : ""}`, "ok");
          if (result.unmatched?.length) note(`No CDS record found for ${result.unmatched.join(", ")}; read CDS first`, "error");
        } else note(`Could not save ${names}: ${result.error ?? "error"}`, "error");
        reply({ type: "cds-import/ack", requestId, ok: Boolean(response?.ok), error: response?.ok ? null : result.error ?? "error", unmatched: result.unmatched ?? [] });
      });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function open(source: keyof typeof WINDOWS) {
    const target = WINDOWS[source];
    const opened = window.open(target.url, target.name);
    if (!opened) toast.error(`The browser blocked the ${target.label} window. Allow pop-ups for this site and try again.`);
    else note(`${target.label} window opened. Keep this page open while it reads the talents.`);
  }

  async function addNewTalents() {
    setApplying(true);
    let totals = { matched: 0, created: 0, review: 0, boardsCreated: 0 };
    try {
      for (let round = 0; round < 100; round += 1) {
        const response = await fetch("/api/dashboard/cds/apply", { method: "POST" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) { toast.error(payload.error ?? "The import stopped. Try again."); break; }
        totals = { matched: totals.matched + payload.matched, created: totals.created + payload.created, review: totals.review + payload.review, boardsCreated: totals.boardsCreated + payload.boardsCreated };
        note(`Added ${payload.created}, already in dashboard ${payload.matched}, to review ${payload.review}${payload.repaired ? `, completed ${payload.repaired}` : ""}; ${payload.remaining} left`, "ok");
        if (!payload.remaining) break;
      }
      toast.success(`${totals.created} new talents added as drafts; ${totals.matched} were already in the dashboard${totals.review ? `; ${totals.review} need review` : ""}.`);
    } finally {
      setApplying(false);
      router.refresh();
    }
  }

  async function verify() {
    setVerifying(true);
    setVerification([]);
    try {
      for (let start = 0; ; start += VERIFY_BATCH) {
        const response = await fetch(`/api/dashboard/cds/verify?start=${start}&count=${VERIFY_BATCH}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) { toast.error(payload.error ?? "The check could not finish. Try again."); return; }
        setVerifyTotal(payload.total);
        setVerification((rows) => [...(rows ?? []), ...payload.rows]);
        if (start + VERIFY_BATCH >= payload.total) return;
      }
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setVerifying(false);
    }
  }

  const sum = (key: "listed" | "verified" | "duplicates" | "waiting" | "failed" | "missingFile" | "wrongTalent" | "thumbnails" | "bytes") => (verification ?? []).reduce((total, row) => total + row[key], 0);
  const problems = (row: VerifyRow) => [
    row.failed && `${row.failed} failed`, row.missingFile && `${row.missingFile} file missing`, row.wrongTalent && `${row.wrongTalent} wrong talent`,
    row.duplicates && `${row.duplicates} identical`, !row.talentId && (row.note ?? "Not linked to a talent"),
  ].filter(Boolean).join(" · ");

  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => open("cds")}><ExternalLink size={14} /> 1. Open CDS</Button>
      <Button onClick={() => open("wff")}><ExternalLink size={14} /> 2. Open WebForFashion</Button>
      <Button variant="secondary" onClick={addNewTalents} disabled={applying}><UserPlus size={14} /> {applying ? "Adding…" : `3. Add new talents${pending ? ` (${pending} ready)` : ""}`}</Button>
      <Button variant="secondary" onClick={verify} disabled={verifying}><ShieldCheck size={14} /> {verifying ? "Checking every file…" : "5. Verify photos"}</Button>
      {received > 0 && <Button variant="ghost" onClick={() => router.refresh()}>Refresh totals ({received} received)</Button>}
    </div>
    {verification && <div className="space-y-3 rounded-md border border-[#efefeb] bg-[#fafaf8] p-3">
      <p className="text-sm"><span className="font-800">{verifying ? `Checking: ${verification.length} of ${verifyTotal} models so far. ` : ""}{sum("verified") + sum("duplicates")} of {sum("listed")} CDS photos accounted for</span>: {sum("verified")} unique files verified in storage ({gigabytes(sum("bytes"))}) and {sum("duplicates")} identical copies of those files, across {verification.filter((row) => row.talentId).length} of {verification.length} models. {sum("waiting")} waiting · {sum("failed")} failed · {sum("missingFile")} file missing · {sum("wrongTalent")} wrong talent · {sum("thumbnails")} thumbnails.</p>
      <div className="relative max-h-96 overflow-auto"><table className="w-full min-w-[560px] text-left text-xs">
        <thead><tr className="border-b border-[#efefeb] text-[9px] font-800 uppercase tracking-[.14em] text-[#6b6d66]"><th className="py-2 pr-4">Model</th><th className="py-2 pr-4">In CDS</th><th className="py-2 pr-4">Verified</th><th className="py-2 pr-4">Waiting</th><th className="py-2">Note</th></tr></thead>
        <tbody>{[...verification].sort((a, b) => a.name.localeCompare(b.name)).map((row) => <tr key={row.cdsId} className="border-b border-[#f3f3f0] last:border-0">
          <td className="py-1.5 pr-4 font-700">{row.name}</td><td className="py-1.5 pr-4">{row.listed}</td><td className="py-1.5 pr-4">{row.verified}</td><td className="py-1.5 pr-4">{row.waiting}</td><td className="py-1.5 text-[#6b6d66]">{problems(row)}</td>
        </tr>)}</tbody>
      </table></div>
    </div>}
    {lines.length > 0 && <ol className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-[#efefeb] bg-[#fafaf8] p-3 font-mono text-[11px]" aria-live="polite">
      {lines.map((line, index) => <li key={index} className={line.tone === "error" ? "text-[#a9593d]" : line.tone === "ok" ? "text-[#3f6b45]" : "text-[#6b6d66]"}>{line.at} · {line.text}</li>)}
    </ol>}
  </div>;
}
