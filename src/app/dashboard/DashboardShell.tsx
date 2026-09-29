"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardList, FileText, Globe2, Grid2X2, ImageIcon, LayoutDashboard, LogOut, Menu, Plus, Search, Settings2, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Talent } from "@/lib/data";
import { createClient } from "@/lib/supabase";
import { TeamPanel } from "./TeamPanel";
import { TalentEditor } from "./TalentEditor";

type Board = { id: string; name: string; slug: string; is_active?: boolean; internal_only?: boolean; publish_to_website?: boolean; show_in_navigation?: boolean };
type Overview = { metrics: { totalTalent: number; publishedTalent: number; pendingReview: number; drafts: number }; boards: Board[]; recent: { id: string; display_name: string; publication_status: string; updated_at: string }[]; actions: unknown[] };

const nav = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Talent", icon: UsersRound },
  { label: "Boards", icon: Grid2X2 },
  { label: "Calendar", icon: CalendarDays },
];

const manageNav = [
  { label: "Media library", icon: ImageIcon },
  { label: "Applications", icon: ClipboardList },
  { label: "Documents", icon: FileText },
  { label: "Website CMS", icon: Globe2 },
  { label: "Settings", icon: Settings2 },
];

const managePanels: Record<string, { title: string; detail: string }> = {
  "Media library": { title: "Media library", detail: "Media is currently managed from each talent record. A standalone library will appear here when media records exist." },
  Applications: { title: "Applications", detail: "No application records or application workflow have been configured yet." },
  Documents: { title: "Documents", detail: "Document records are available inside each talent record. No standalone document records exist yet." },
  "Website CMS": { title: "Website CMS", detail: "No CMS pages or publishing configurations have been created yet." },
  Settings: { title: "Settings", detail: "Workspace settings are not configured yet. Access control remains enforced through Supabase roles." },
};

export function DashboardShell() {
  const [active, setActive] = useState("Overview");
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [talents, setTalents] = useState<Talent[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNewTalent, setShowNewTalent] = useState(false);
  const [selectedTalent, setSelectedTalent] = useState<string | null>(null);
  const [me, setMe] = useState<{ name: string; email: string; role: string } | null>(null);
  const router = useRouter();

  const refresh = useCallback(async () => {
    setLoadError("");
    const [meResponse, talentResponse, overviewResponse, boardsResponse] = await Promise.all([
      fetch("/api/dashboard/me"), fetch("/api/dashboard/talents"), fetch("/api/dashboard/overview"), fetch("/api/dashboard/boards"),
    ]);
    const mePayload = await meResponse.json(); const talentPayload = await talentResponse.json(); const overviewPayload = await overviewResponse.json(); const boardsPayload = await boardsResponse.json();
    if (!meResponse.ok) throw new Error(mePayload.error ?? "Unable to load your account");
    if (!talentResponse.ok) throw new Error(talentPayload.error ?? "Unable to load talent");
    if (!overviewResponse.ok) throw new Error(overviewPayload.error ?? "Unable to load overview");
    if (!boardsResponse.ok) throw new Error(boardsPayload.error ?? "Unable to load boards");
    setMe(mePayload); setTalents(talentPayload); setOverview(overviewPayload); setBoards(boardsPayload);
  }, []);

  useEffect(() => { let cancelled = false; Promise.resolve().then(() => refresh()).catch((error: Error) => { if (!cancelled) setLoadError(error.message); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [refresh]);
  const filtered = useMemo(() => talents.filter((talent) => `${talent.name} ${talent.board} ${talent.location}`.toLowerCase().includes(search.toLowerCase())), [search, talents]);

  async function togglePublish(talent: Talent) {
    const nextPublished = talent.status !== "published";
    const response = await fetch(`/api/dashboard/talents/${talent.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publication_status: nextPublished ? "published" : "review", show_on_website: nextPublished }) });
    if (response.ok) await refresh();
  }
  async function signOut() { await createClient().auth.signOut(); router.push("/login"); }

  return <main className="min-h-screen bg-[#f7f7f5] text-[#20211f]"><div className="flex min-h-screen">
    <aside className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-[#e7e7e3] bg-[#20211f] px-5 py-6 text-white transition-transform lg:static lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center justify-between px-2"><Link href="/" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 text-[11px] font-800 tracking-[-.08em]">42</span><span className="text-[10px] font-800 uppercase tracking-[.16em]">Agency OS</span></Link><button className="lg:hidden" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
      <div className="mt-12 px-2 text-[9px] font-800 uppercase tracking-[.2em] text-white/35">Workspace</div>
      <nav className="mt-3 space-y-1">{nav.map((item) => { const Icon = item.icon; return <button key={item.label} onClick={() => { setActive(item.label); setMobileOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[12px] font-600 transition-colors ${active === item.label ? "bg-white text-[#20211f]" : "text-white/60 hover:bg-white/10 hover:text-white"}`}><Icon size={16} strokeWidth={1.8} />{item.label}</button>; })}</nav>
      {me?.role === "owner" && <><div className="mt-10 px-2 text-[9px] font-800 uppercase tracking-[.2em] text-white/35">Manage</div><nav className="mt-3 space-y-1">{manageNav.map((item) => { const Icon = item.icon; return <button key={item.label} onClick={() => { setActive(item.label); setMobileOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[12px] font-600 ${active === item.label ? "bg-white text-[#20211f]" : "text-white/60 hover:bg-white/10 hover:text-white"}`}><Icon size={16} strokeWidth={1.8} />{item.label}</button>; })}<button onClick={() => { setActive("Team"); setMobileOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[12px] font-600 ${active === "Team" ? "bg-white text-[#20211f]" : "text-white/60 hover:bg-white/10 hover:text-white"}`}><UsersRound size={16} strokeWidth={1.8} />Team access</button></nav></>}
      <div className="mt-auto border-t border-white/10 pt-5"><button onClick={signOut} className="flex w-full items-center gap-3 px-3 py-3 text-[12px] text-white/55 hover:text-white"><LogOut size={16} />Sign out</button></div>
    </aside>
    <section className="min-w-0 flex-1"><header className="flex h-[76px] items-center justify-between border-b border-[#e7e7e3] bg-white px-5 sm:px-8"><div className="flex items-center gap-4"><button className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div><p className="text-[10px] font-800 uppercase tracking-[.18em] text-[#a2a39d]">Agency workspace</p><h1 className="mt-1 text-lg font-700">Good morning, {me?.name ?? "there"}</h1></div></div><div className="text-right"><p className="text-[11px] font-700">{me?.name ?? "Agency user"}</p><p className="text-[9px] uppercase tracking-[.13em] text-[#a2a39d]">{me?.role?.replaceAll("_", " ") ?? "Agency"}</p></div></header>
      <div className="p-5 sm:p-8 lg:p-10">{loading && <p className="mb-5 rounded-md bg-white px-4 py-3 text-xs text-[#8d8f88]">Loading live agency data…</p>}{loadError && <p className="mb-5 rounded-md bg-[#f8e8df] px-4 py-3 text-xs text-[#a9593d]">{loadError}</p>}
        {active === "Overview" && <OverviewPanel overview={overview} onNew={() => setShowNewTalent(true)} onOpenTalent={() => setActive("Talent")} />}
        {active === "Talent" && <TalentPage talents={filtered} search={search} setSearch={setSearch} onAdd={() => setShowNewTalent(true)} onOpen={setSelectedTalent} onToggle={togglePublish} />}
        {active === "Boards" && <BoardsPanel boards={boards} />}
        {active === "Calendar" && <EmptyPanel title="Calendar" detail="No appointments or bookings have been created yet." />}
        {managePanels[active] && <EmptyPanel title={managePanels[active].title} detail={managePanels[active].detail} />}
        {active === "Team" && <TeamPanel />}
      </div>
    </section>
  </div>{showNewTalent && <NewTalentModal boards={boards} onClose={() => setShowNewTalent(false)} onCreated={async (id) => { setShowNewTalent(false); await refresh(); setActive("Talent"); setSelectedTalent(id); }} />}{selectedTalent && <TalentEditor id={selectedTalent} boards={boards} onClose={() => setSelectedTalent(null)} onSaved={refresh} />}</main>;
}

function OverviewPanel({ overview, onNew, onOpenTalent }: { overview: Overview | null; onNew: () => void; onOpenTalent: () => void }) {
  const metrics = overview?.metrics ?? { totalTalent: 0, publishedTalent: 0, pendingReview: 0, drafts: 0 };
  return <><div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-[10px] font-800 uppercase tracking-[.2em] text-[#c26a48]">Command center</p><h2 className="mt-2 text-3xl font-700 tracking-[-.03em]">Agency overview</h2><p className="mt-3 text-sm text-[#8d8f88]">Live operational data from your agency workspace.</p></div><button onClick={onNew} className="flex w-fit items-center gap-2 rounded-md bg-[#20211f] px-4 py-3 text-[11px] font-700 text-white hover:bg-[#c26a48]"><Plus size={15} /> New talent</button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total talent" value={metrics.totalTalent} /><Metric label="Published" value={metrics.publishedTalent} /><Metric label="Pending review" value={metrics.pendingReview} /><Metric label="Drafts" value={metrics.drafts} /></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-2"><DataCard title="Recent talent activity" action={metrics.totalTalent ? <button onClick={onOpenTalent} className="text-[10px] font-800 uppercase tracking-[.14em] text-[#c26a48]">View talent ↗</button> : null}>{overview?.recent.length ? <div className="divide-y divide-[#eee]">{overview.recent.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="text-[12px] font-700">{item.display_name}</p><p className="mt-1 text-[10px] text-[#a2a39d]">{item.publication_status.replaceAll("_", " ")}</p></div><time className="text-[10px] text-[#a2a39d]">{new Date(item.updated_at).toLocaleDateString()}</time></div>)}</div> : <EmptyState text="No talent activity yet." />}</DataCard><DataCard title="Action required"><EmptyState text="No open actions." /></DataCard></div>
    <div className="mt-6"><DataCard title="Boards"><div className="divide-y divide-[#eee]">{overview?.boards.length ? overview.boards.map((board) => <div key={board.id} className="flex items-center justify-between px-5 py-4"><div><p className="text-[12px] font-700">{board.name}</p><p className="mt-1 text-[10px] text-[#a2a39d]">{board.internal_only ? "Internal" : board.publish_to_website ? "Public website" : "Not published"}</p></div><span className={`h-2 w-2 rounded-full ${board.is_active ? "bg-[#7f9a82]" : "bg-[#c8c8c3]"}`} /></div>) : <EmptyState text="No boards configured." />}</div></DataCard></div>
  </>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-[#e7e7e3] bg-white p-5"><p className="text-[10px] font-800 uppercase tracking-[.13em] text-[#a2a39d]">{label}</p><p className="mt-2 text-3xl font-700 tracking-[-.04em]">{value}</p></div>; }
function DataCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return <div className="overflow-hidden rounded-xl border border-[#e7e7e3] bg-white"><div className="flex items-center justify-between border-b border-[#e7e7e3] px-5 py-4"><h3 className="text-sm font-700">{title}</h3>{action}</div>{children}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="grid min-h-32 place-items-center px-5 text-center text-xs text-[#a2a39d]">{text}</div>; }
function EmptyPanel({ title, detail }: { title: string; detail: string }) { return <div className="grid min-h-[50vh] place-items-center rounded-xl border border-dashed border-[#d9dad5] bg-white"><div className="text-center"><p className="text-[10px] font-800 uppercase tracking-[.2em] text-[#c26a48]">{title}</p><h2 className="mt-3 text-2xl font-700">Nothing here yet</h2><p className="mt-3 max-w-sm text-sm leading-6 text-[#8d8f88]">{detail}</p></div></div>; }
function BoardsPanel({ boards }: { boards: Board[] }) { return <><div className="mb-8"><p className="text-[10px] font-800 uppercase tracking-[.2em] text-[#c26a48]">Organization</p><h2 className="mt-2 text-3xl font-700">Boards</h2><p className="mt-3 text-sm text-[#8d8f88]">Boards are managed in Supabase and control public placement.</p></div><DataCard title="Configured boards">{boards.length ? <div className="divide-y divide-[#eee]">{boards.map((board) => <div key={board.id} className="flex items-center justify-between px-5 py-4"><div><p className="text-sm font-700">{board.name}</p><p className="mt-1 text-xs text-[#a2a39d]">{board.slug}</p></div><span className="text-[10px] uppercase tracking-[.12em] text-[#7f9a82]">{board.is_active ? "Active" : "Inactive"}</span></div>)}</div> : <EmptyState text="No boards configured." />}</DataCard></>; }

function TalentPage({ talents, search, setSearch, onAdd, onOpen, onToggle }: { talents: Talent[]; search: string; setSearch: (value: string) => void; onAdd: () => void; onOpen: (id: string) => void; onToggle: (talent: Talent) => void }) { return <><div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-[10px] font-800 uppercase tracking-[.2em] text-[#c26a48]">Directory</p><h2 className="mt-2 text-3xl font-700 tracking-[-.03em]">Talent</h2></div><button onClick={onAdd} className="flex w-fit items-center gap-2 rounded-md bg-[#20211f] px-4 py-3 text-[11px] font-700 text-white"><Plus size={15} /> New talent</button></div><div className="mb-4 flex items-center gap-3 rounded-lg border border-[#e7e7e3] bg-white px-4 py-3"><Search size={16} className="text-[#a2a39d]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, board, or location" className="w-full bg-transparent text-sm outline-none placeholder:text-[#b1b2ad]" /></div><div className="overflow-hidden rounded-xl border border-[#e7e7e3] bg-white">{talents.length ? <div className="divide-y divide-[#eee]">{talents.map((talent) => <div key={talent.id} className="flex items-center gap-4 px-5 py-4"><button onClick={() => onOpen(talent.id)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-700">{talent.name}</p><p className="mt-1 truncate text-[10px] text-[#a2a39d]">{talent.talentId} · {talent.board} · {talent.location || "No location"}</p></button><span className="rounded-full bg-[#f1f1ee] px-2 py-1 text-[9px] font-800 uppercase tracking-[.1em] text-[#777970]">{talent.status}</span><button onClick={() => onToggle(talent)} className="text-[10px] font-800 uppercase tracking-[.1em] text-[#c26a48]">{talent.status === "published" ? "Unpublish" : "Publish"}</button></div>)}</div> : <EmptyState text={search ? "No talent matches this search." : "No talent records yet. Create your first draft to begin."} />}</div></>; }

function NewTalentModal({ boards, onClose, onCreated }: { boards: Board[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", displayName: "", location: "", gender: "", dateOfBirth: "", dateJoined: "", boardSlug: "" });
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); const response = await fetch("/api/dashboard/talents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); const payload = await response.json(); if (!response.ok) setError(payload.error ?? "Unable to create talent"); else onCreated(payload.id); setSaving(false); }
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-[#20211f]/45 p-4 sm:p-8"><form onSubmit={submit} className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-center justify-between"><div><p className="text-[10px] font-800 uppercase tracking-[.18em] text-[#c26a48]">Talent core</p><h2 className="mt-2 text-xl font-700">Create talent record</h2><p className="mt-2 text-xs text-[#8d8f88]">This creates a real draft. You can complete every field in the editor next.</p></div><button type="button" onClick={onClose}><X size={18} /></button></div><div className="mt-7 grid gap-4 sm:grid-cols-2"><Field label="First name" required value={form.firstName} onChange={(value) => setForm({ ...form, firstName: value })} /><Field label="Last name" required value={form.lastName} onChange={(value) => setForm({ ...form, lastName: value })} /><Field label="Display name" value={form.displayName} onChange={(value) => setForm({ ...form, displayName: value })} /><Field label="Location" value={form.location} onChange={(value) => setForm({ ...form, location: value })} /><Field label="Gender" value={form.gender} onChange={(value) => setForm({ ...form, gender: value })} /><Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={(value) => setForm({ ...form, dateOfBirth: value })} /><Field label="Date joined" type="date" value={form.dateJoined} onChange={(value) => setForm({ ...form, dateJoined: value })} /><label className="text-[10px] font-800 uppercase tracking-[.14em] text-[#8d8f88]">Board<select required value={form.boardSlug} onChange={(event) => setForm({ ...form, boardSlug: event.target.value })} className="mt-2 w-full rounded-md border border-[#e7e7e3] bg-white px-3 py-3 text-sm normal-case tracking-normal"><option value="">Choose a board</option>{boards.map((board) => <option key={board.id} value={board.slug}>{board.name}</option>)}</select></label></div>{error && <p className="mt-4 rounded-md bg-[#f8e8df] px-3 py-2 text-xs text-[#a9593d]">{error}</p>}<div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-md border border-[#e7e7e3] px-4 py-3 text-[11px] font-700">Cancel</button><button disabled={saving} className="rounded-md bg-[#20211f] px-4 py-3 text-[11px] font-700 text-white disabled:opacity-50">{saving ? "Creating…" : "Create draft"}</button></div></form></div>;
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="text-[10px] font-800 uppercase tracking-[.14em] text-[#8d8f88]">{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-[#e7e7e3] px-3 py-3 text-sm font-500 normal-case tracking-normal outline-none focus:border-[#c26a48]" /></label>; }
