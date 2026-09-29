"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, ChevronDown, Grid2X2, Image as ImageIcon, LayoutDashboard, LogOut, Menu, Plus, Search, Settings, UserRound, UsersRound, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Talent } from "@/lib/data";
import { createClient } from "@/lib/supabase";
import { TeamPanel } from "./TeamPanel";

const nav = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Talent", icon: UsersRound },
  { label: "Boards", icon: Grid2X2 },
  { label: "Applications", icon: UserRound, badge: "8" },
  { label: "Calendar", icon: CalendarDays },
];

export function DashboardShell() {
  const [active, setActive] = useState("Overview");
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [talents, setTalents] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNewTalent, setShowNewTalent] = useState(false);
  const [me, setMe] = useState<{ name: string; email: string; role: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    Promise.all([fetch("/api/dashboard/me"), fetch("/api/dashboard/talents")])
      .then(async ([meResponse, talentResponse]) => {
        const mePayload = await meResponse.json();
        if (!meResponse.ok) throw new Error(mePayload.error ?? "Unable to load your account");
        const talentPayload = await talentResponse.json();
        if (!talentResponse.ok) throw new Error(talentPayload.error ?? "Unable to load talent");
        setMe(mePayload);
        setTalents(talentPayload);
      })
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => talents.filter((talent) => `${talent.name} ${talent.board} ${talent.location}`.toLowerCase().includes(search.toLowerCase())), [search, talents]);
  const publishCount = talents.filter((talent) => talent.status === "published").length;
  const reviewCount = talents.filter((talent) => talent.status === "review").length;

  async function togglePublish(id: string) {
    const talent = talents.find((item) => item.id === id);
    if (!talent) return;
    const nextPublished = talent.status !== "published";
    const response = await fetch(`/api/dashboard/talents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publication_status: nextPublished ? "published" : "review", show_on_website: nextPublished }) });
    if (!response.ok) return;
    setTalents((current) => current.map((item) => item.id === id ? { ...item, status: nextPublished ? "published" : "review", showOnWebsite: nextPublished } : item));
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#20211f]">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-[#e7e7e3] bg-[#20211f] px-5 py-6 text-white transition-transform lg:static lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between px-2"><Link href="/" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 text-[11px] font-800 tracking-[-.08em]">42</span><span className="text-[10px] font-800 uppercase tracking-[.16em]">Agency OS</span></Link><button className="lg:hidden" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
          <div className="mt-12 px-2 text-[9px] font-800 uppercase tracking-[.2em] text-white/35">Workspace</div>
          <nav className="mt-3 space-y-1">{nav.map((item) => { const Icon = item.icon; return <button key={item.label} onClick={() => { setActive(item.label); setMobileOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-[12px] font-600 transition-colors ${active === item.label ? "bg-white text-[#20211f]" : "text-white/60 hover:bg-white/10 hover:text-white"}`}><span className="flex items-center gap-3"><Icon size={16} strokeWidth={1.8} />{item.label}</span>{item.badge && <span className={`rounded-full px-2 py-0.5 text-[9px] ${active === item.label ? "bg-[#dcb5a4]" : "bg-white/10"}`}>{item.badge}</span>}</button>; })}</nav>
          <div className="mt-10 px-2 text-[9px] font-800 uppercase tracking-[.2em] text-white/35">Manage</div>
          <nav className="mt-3 space-y-1"><button onClick={() => setActive("Media library")} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[12px] font-600 text-white/60 hover:bg-white/10 hover:text-white"><ImageIcon size={16} strokeWidth={1.8} />Media library</button><button onClick={() => setActive("Website CMS")} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[12px] font-600 text-white/60 hover:bg-white/10 hover:text-white"><Grid2X2 size={16} strokeWidth={1.8} />Website CMS</button>{me?.role === "owner" && <button onClick={() => setActive("Team")} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[12px] font-600 ${active === "Team" ? "bg-white text-[#20211f]" : "text-white/60 hover:bg-white/10 hover:text-white"}`}><UsersRound size={16} strokeWidth={1.8} />Team access</button>}</nav>
          <div className="mt-auto border-t border-white/10 pt-5"><button className="flex w-full items-center gap-3 px-3 py-3 text-[12px] text-white/55 hover:text-white"><Settings size={16} />Settings</button><button onClick={signOut} className="flex w-full items-center gap-3 px-3 py-3 text-[12px] text-white/55 hover:text-white"><LogOut size={16} />Sign out</button></div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex h-[76px] items-center justify-between border-b border-[#e7e7e3] bg-white px-5 sm:px-8"><div className="flex items-center gap-4"><button className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div><p className="text-[10px] font-800 uppercase tracking-[.18em] text-[#a2a39d]">Agency workspace</p><h1 className="mt-1 text-lg font-700">Good morning, {me?.name ?? "there"}</h1></div></div><div className="flex items-center gap-5"><button className="relative text-[#74766f]"><Bell size={19} /><span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#c26a48]" /></button><div className="flex items-center gap-3 border-l border-[#e7e7e3] pl-5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d7b9a9] text-[11px] font-800">{(me?.name ?? "AU").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div className="hidden sm:block"><p className="text-[11px] font-700">{me?.name ?? "Agency user"}</p><p className="text-[9px] uppercase tracking-[.13em] text-[#a2a39d]">{me?.role?.replaceAll("_", " ") ?? "Agency"}</p></div><ChevronDown size={14} className="text-[#a2a39d]" /></div></div></header>
          <div className="p-5 sm:p-8 lg:p-10">
            {loading && <p className="mb-5 rounded-md bg-white px-4 py-3 text-xs text-[#8d8f88]">Loading live talent data…</p>}
            {loadError && <p className="mb-5 rounded-md bg-[#f8e8df] px-4 py-3 text-xs text-[#a9593d]">{loadError}</p>}
            {active === "Overview" && <>
              <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-[10px] font-800 uppercase tracking-[.2em] text-[#c26a48]">Command center</p><h2 className="mt-2 text-3xl font-700 tracking-[-.03em]">Agency overview</h2></div><button onClick={() => setShowNewTalent(true)} className="flex w-fit items-center gap-2 rounded-md bg-[#20211f] px-4 py-3 text-[11px] font-700 text-white transition-colors hover:bg-[#c26a48]"><Plus size={15} /> New talent</button></div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Published talent" value={publishCount.toString()} change="+4 this month" tone="green" /><Metric label="Pending review" value={reviewCount.toString()} change="Needs attention" tone="orange" /><Metric label="Upcoming castings" value="12" change="Next 7 days" tone="blue" /><Metric label="Applications" value="8" change="New this week" tone="purple" /></div>
              <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
                <div className="rounded-xl border border-[#e7e7e3] bg-white"><div className="flex items-center justify-between border-b border-[#e7e7e3] px-5 py-4"><div><h3 className="text-sm font-700">Talent roster</h3><p className="mt-1 text-[10px] text-[#a2a39d]">Latest profile activity</p></div><button onClick={() => setActive("Talent")} className="text-[10px] font-800 uppercase tracking-[.14em] text-[#c26a48]">View all ↗</button></div><TalentTable talents={filtered.slice(0, 5)} onToggle={togglePublish} /></div>
                <div className="rounded-xl border border-[#e7e7e3] bg-white"><div className="border-b border-[#e7e7e3] px-5 py-4"><h3 className="text-sm font-700">Action required</h3><p className="mt-1 text-[10px] text-[#a2a39d]">Keep your workflow moving</p></div><div className="divide-y divide-[#eee]">{[{title:"Review new submission", detail:"Amara Lewis · 6 images", color:"bg-[#d9c4b7]"},{title:"Contract expiring soon", detail:"Noah Cole · 14 days", color:"bg-[#c3d0c6]"},{title:"Publish approved media", detail:"Maya Parker · 3 images", color:"bg-[#cec8db]"}].map((item) => <div key={item.title} className="flex items-center gap-3 px-5 py-4"><span className={`h-2 w-2 rounded-full ${item.color}`} /><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-700">{item.title}</p><p className="mt-1 text-[10px] text-[#a2a39d]">{item.detail}</p></div><button className="text-[10px] font-800 uppercase tracking-[.1em] text-[#c26a48]">Open</button></div>)}</div></div>
              </div>
              <div className="mt-6 rounded-xl border border-[#e7e7e3] bg-white p-5"><div className="flex items-center justify-between"><div><h3 className="text-sm font-700">Board performance</h3><p className="mt-1 text-[10px] text-[#a2a39d]">Published roster by active board</p></div><button className="text-[#a2a39d]"><ChevronDown size={16} /></button></div><div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[{name:"Women / Development", count:22, color:"bg-[#d0c8b9]"},{name:"Men / Mainboard", count:14, color:"bg-[#b8c4ce]"},{name:"Women / Mainboard", count:18, color:"bg-[#d7b9b2]"}].map((board) => <div key={board.name}><div className="mb-2 flex justify-between text-[11px] font-700"><span>{board.name}</span><span className="text-[#a2a39d]">{board.count}</span></div><div className="h-2 rounded-full bg-[#f0f0ed]"><div className={`h-2 rounded-full ${board.color}`} style={{ width: `${Math.min(board.count * 3.4, 100)}%` }} /></div></div>)}</div></div>
            </>}
            {active === "Talent" && <TalentPage talents={filtered} search={search} setSearch={setSearch} onAdd={() => setShowNewTalent(true)} onToggle={togglePublish} />}
            {active === "Team" && <TeamPanel />}
            {active !== "Overview" && active !== "Talent" && active !== "Team" && <div className="grid min-h-[60vh] place-items-center rounded-xl border border-dashed border-[#d9dad5] bg-white"><div className="text-center"><p className="text-[10px] font-800 uppercase tracking-[.2em] text-[#c26a48]">{active}</p><h2 className="mt-3 text-2xl font-700">Module ready for connection</h2><p className="mt-3 max-w-sm text-sm leading-6 text-[#8d8f88]">This production shell is ready to connect to the corresponding Supabase tables and RLS policies.</p></div></div>}
          </div>
        </section>
      </div>
      {showNewTalent && <NewTalentModal onClose={() => setShowNewTalent(false)} onCreated={(talent) => { setTalents((current) => [talent, ...current]); setShowNewTalent(false); }} />}
    </main>
  );
}

function Metric({ label, value, change, tone }: { label: string; value: string; change: string; tone: string }) { return <div className="rounded-xl border border-[#e7e7e3] bg-white p-5"><div className={`mb-6 h-2 w-2 rounded-full ${tone === "green" ? "bg-[#9eb39e]" : tone === "orange" ? "bg-[#d5a789]" : tone === "blue" ? "bg-[#9caec0]" : "bg-[#b9aacd]"}`} /><p className="text-[10px] font-800 uppercase tracking-[.13em] text-[#a2a39d]">{label}</p><p className="mt-2 text-3xl font-700 tracking-[-.04em]">{value}</p><p className="mt-2 text-[10px] font-700 text-[#7f9a82]">{change}</p></div>; }

function TalentTable({ talents, onToggle }: { talents: Talent[]; onToggle: (id: string) => void }) { return <div className="divide-y divide-[#eee]">{talents.map((talent) => <div key={talent.id} className="flex items-center gap-3 px-5 py-3"><div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#ddd8cf]"><Image src={talent.image} alt="" fill sizes="40px" className="object-cover" /></div><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-700">{talent.name}</p><p className="mt-1 truncate text-[10px] text-[#a2a39d]">{talent.board}</p></div><div className="hidden text-right sm:block"><p className="text-[10px] text-[#a2a39d]">{talent.id}</p><button onClick={() => onToggle(talent.id)} className={`mt-1 rounded-full px-2 py-1 text-[9px] font-800 uppercase tracking-[.1em] ${talent.status === "published" ? "bg-[#e4eee5] text-[#6d8c71]" : "bg-[#f8e8df] text-[#b56d4b]"}`}>{talent.status === "published" ? "Published" : "Review"}</button></div></div>)}</div>; }

function TalentPage({ talents, search, setSearch, onAdd, onToggle }: { talents: Talent[]; search: string; setSearch: (value: string) => void; onAdd: () => void; onToggle: (id: string) => void }) { return <><div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-[10px] font-800 uppercase tracking-[.2em] text-[#c26a48]">Directory</p><h2 className="mt-2 text-3xl font-700 tracking-[-.03em]">Talent</h2></div><button onClick={onAdd} className="flex w-fit items-center gap-2 rounded-md bg-[#20211f] px-4 py-3 text-[11px] font-700 text-white"><Plus size={15} /> New talent</button></div><div className="mb-4 flex items-center gap-3 rounded-lg border border-[#e7e7e3] bg-white px-4 py-3"><Search size={16} className="text-[#a2a39d]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, board, or location" className="w-full bg-transparent text-sm outline-none placeholder:text-[#b1b2ad]" /></div><div className="overflow-hidden rounded-xl border border-[#e7e7e3] bg-white"><TalentTable talents={talents} onToggle={onToggle} /></div></>; }

function NewTalentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (talent: Talent) => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", location: "", gender: "", boardSlug: "development-men" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true); setError("");
    const response = await fetch("/api/dashboard/talents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const payload = await response.json();
    if (!response.ok) setError(payload.error ?? "Unable to create talent"); else onCreated(payload);
    setSaving(false);
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#20211f]/45 p-4"><div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-[10px] font-800 uppercase tracking-[.18em] text-[#c26a48]">Talent core</p><h2 className="mt-2 text-xl font-700">Create new talent</h2></div><button onClick={onClose}><X size={18} /></button></div><div className="mt-7 grid gap-4 sm:grid-cols-2"><Field label="First name" placeholder="e.g. Saih" value={form.firstName} onChange={(value) => setForm({ ...form, firstName: value })} /><Field label="Last name" placeholder="e.g. Williams" value={form.lastName} onChange={(value) => setForm({ ...form, lastName: value })} /><Field label="Location" placeholder="Dallas" value={form.location} onChange={(value) => setForm({ ...form, location: value })} /><Field label="Gender" placeholder="Male / Female / Other" value={form.gender} onChange={(value) => setForm({ ...form, gender: value })} /></div><div className="mt-4"><label className="text-[10px] font-800 uppercase tracking-[.14em] text-[#8d8f88]">Board assignment</label><select value={form.boardSlug} onChange={(event) => setForm({ ...form, boardSlug: event.target.value })} className="mt-2 w-full rounded-md border border-[#e7e7e3] bg-white px-3 py-3 text-sm"><option value="development-men">Development – Men</option><option value="fashion-women">Fashion – Women</option><option value="development-women">Development – Women</option><option value="curve-women">Curve – Women</option><option value="fashion-men">Fashion – Men</option><option value="teens-boys">Teens – Boys</option></select></div>{error && <p className="mt-4 rounded-md bg-[#f8e8df] px-3 py-2 text-xs text-[#a9593d]">{error}</p>}<div className="mt-7 flex justify-end gap-3"><button onClick={onClose} className="rounded-md border border-[#e7e7e3] px-4 py-3 text-[11px] font-700">Cancel</button><button onClick={submit} disabled={saving} className="rounded-md bg-[#20211f] px-4 py-3 text-[11px] font-700 text-white disabled:opacity-50">{saving ? "Creating…" : "Create draft"}</button></div></div></div>;
}
function Field({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) { return <label className="text-[10px] font-800 uppercase tracking-[.14em] text-[#8d8f88]">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-md border border-[#e7e7e3] px-3 py-3 text-sm font-500 normal-case tracking-normal outline-none focus:border-[#c26a48]" /></label>; }
