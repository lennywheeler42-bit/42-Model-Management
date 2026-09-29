"use client";

import { useEffect, useState } from "react";
import { Check, Shield, UserPlus } from "lucide-react";

const roles = [
  ["administrator", "Administrator"],
  ["staff", "Staff"],
  ["booker", "Booker"],
  ["talent_manager", "Talent manager"],
  ["creative", "Creative"],
  ["accounting", "Accounting"],
  ["read_only", "Read only"],
] as const;

type Member = { id: string; email: string; full_name: string; role: string; status: string };

export function TeamPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState({ email: "", fullName: "", role: "staff", status: "active" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/team")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load team access");
        if (!cancelled) setMembers(payload);
      })
      .catch((loadError: Error) => { if (!cancelled) setError(loadError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function saveMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage(""); setError("");
    const response = await fetch("/api/dashboard/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const payload = await response.json();
    if (!response.ok) setError(payload.error ?? "Unable to save access");
    else { setMessage(`${payload.email} is now ${payload.status}.`); setMembers((current) => { const next = current.filter((member) => member.id !== payload.id); return [...next, payload]; }); setForm({ email: "", fullName: "", role: "staff", status: "active" }); }
    setSaving(false);
  }

  return <div>
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-[10px] font-800 uppercase tracking-[.2em] text-[#c26a48]">Owner controls</p><h2 className="mt-2 text-3xl font-700 tracking-[-.03em]">Team access</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#8d8f88]">Only active emails listed here can enter the agency dashboard. Google sign-in alone never grants access.</p></div><div className="flex items-center gap-2 rounded-full bg-[#e4eee5] px-3 py-2 text-[10px] font-800 uppercase tracking-[.12em] text-[#6d8c71]"><Shield size={14} /> Owner only</div></div>
    <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
      <form onSubmit={saveMember} className="rounded-xl border border-[#e7e7e3] bg-white p-5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4e3da] text-[#c26a48]"><UserPlus size={17} /></span><div><h3 className="text-sm font-700">Approve an email</h3><p className="mt-1 text-[10px] text-[#a2a39d]">Pre-approve access before the user signs in.</p></div></div><div className="mt-6 space-y-4"><label className="block text-[10px] font-800 uppercase tracking-[.14em] text-[#8d8f88]">Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="staff@agency.com" className="mt-2 w-full rounded-md border border-[#e7e7e3] px-3 py-3 text-sm normal-case tracking-normal outline-none focus:border-[#c26a48]" /></label><label className="block text-[10px] font-800 uppercase tracking-[.14em] text-[#8d8f88]">Name<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Team member name" className="mt-2 w-full rounded-md border border-[#e7e7e3] px-3 py-3 text-sm normal-case tracking-normal outline-none focus:border-[#c26a48]" /></label><label className="block text-[10px] font-800 uppercase tracking-[.14em] text-[#8d8f88]">Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="mt-2 w-full rounded-md border border-[#e7e7e3] bg-white px-3 py-3 text-sm normal-case tracking-normal">{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-[10px] font-800 uppercase tracking-[.14em] text-[#8d8f88]">Access status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-2 w-full rounded-md border border-[#e7e7e3] bg-white px-3 py-3 text-sm normal-case tracking-normal"><option value="active">Active — allow dashboard</option><option value="pending">Pending — block dashboard</option><option value="suspended">Suspended — block dashboard</option></select></label></div>{message && <p className="mt-4 flex items-center gap-2 rounded-md bg-[#e4eee5] px-3 py-2 text-xs text-[#6d8c71]"><Check size={14} />{message}</p>}{error && <p className="mt-4 rounded-md bg-[#f8e8df] px-3 py-2 text-xs text-[#a9593d]">{error}</p>}<button disabled={saving} className="mt-6 w-full rounded-md bg-[#20211f] px-4 py-3 text-[11px] font-800 uppercase tracking-[.14em] text-white hover:bg-[#c26a48] disabled:opacity-50">{saving ? "Saving…" : "Save access"}</button></form>
      <div className="overflow-hidden rounded-xl border border-[#e7e7e3] bg-white"><div className="border-b border-[#e7e7e3] px-5 py-4"><h3 className="text-sm font-700">Approved accounts</h3><p className="mt-1 text-[10px] text-[#a2a39d]">Change a role or suspend access by saving the same email again.</p></div>{loading ? <p className="p-5 text-xs text-[#8d8f88]">Loading approved accounts…</p> : members.length === 0 ? <p className="p-5 text-xs text-[#8d8f88]">No approved accounts yet.</p> : <div className="divide-y divide-[#eee]">{members.map((member) => <div key={member.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-700">{member.full_name || member.email}</p><p className="mt-1 truncate text-[10px] text-[#a2a39d]">{member.email}</p></div><span className={`w-fit rounded-full px-2 py-1 text-[9px] font-800 uppercase tracking-[.1em] ${member.status === "active" ? "bg-[#e4eee5] text-[#6d8c71]" : "bg-[#f8e8df] text-[#b56d4b]"}`}>{member.status}</span><span className="w-fit rounded-full bg-[#f1f1ee] px-2 py-1 text-[9px] font-800 uppercase tracking-[.1em] text-[#777970]">{member.role.replaceAll("_", " ")}</span>{member.role !== "owner" && <button type="button" onClick={() => setForm({ email: member.email, fullName: member.full_name, role: member.role, status: member.status })} className="text-left text-[10px] font-800 uppercase tracking-[.12em] text-[#c26a48]">Edit</button>}</div>)}</div>}</div>
    </div>
  </div>;
}
