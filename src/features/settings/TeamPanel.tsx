"use client";

import { useState } from "react";
import { Pencil, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SelectField, TextField } from "@/components/ui/Field";
import { readForm } from "@/lib/read-form";
import { useMutation } from "@/lib/use-mutation";
import { formatDate } from "@/lib/format";

export type Member = { id: string; email: string; full_name: string; role: string; status: string; user_id: string | null; created_at: string };

export const ROLE_OPTIONS = [
  { value: "administrator", label: "Administrator" },
  { value: "talent_manager", label: "Talent manager" },
  { value: "booker", label: "Booker" },
  { value: "creative", label: "Creative / photographer" },
  { value: "accounting", label: "Accounting" },
  { value: "staff", label: "Staff" },
  { value: "read_only", label: "Read only" },
];
const STATUS_OPTIONS = [{ value: "active", label: "Active" }, { value: "pending", label: "Pending" }, { value: "suspended", label: "Suspended" }];
const roleLabel = (role: string) => ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role.replace("_", " ");

// Owner-only: approving an email is what grants dashboard access. Signing in with
// Google alone grants nothing.
export function TeamPanel({ members }: { members: Member[] }) {
  const { run, pending } = useMutation();
  const [editing, setEditing] = useState<Member | null>(null);

  async function approve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = readForm(form);
    if (await run("/api/dashboard/team", { body: { email: values.email, fullName: values.fullName, role: values.role, status: "active" }, success: `${values.email} approved` })) form.reset();
  }

  async function update(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const values = readForm(event.currentTarget);
    if (await run("/api/dashboard/team", { body: { email: editing.email, fullName: values.fullName, role: values.role, status: values.status }, success: "Access updated" })) setEditing(null);
  }

  return <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_1fr]">
    <form onSubmit={approve} className="min-w-0 space-y-4 rounded-xl border border-[#e7e7e3] bg-white p-5">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4e3da] text-[#c26a48]"><UserPlus size={17} /></span>
        <div><h2 className="text-sm font-800">Approve an email</h2><p className="text-[11px] text-[#8d8f88]">They can sign in once their email is confirmed.</p></div></div>
      <TextField label="Work email" name="email" type="email" required autoComplete="off" />
      <TextField label="Full name" name="fullName" />
      <SelectField label="Role" name="role" defaultValue="read_only" options={ROLE_OPTIONS} hint="Start with the least access needed." />
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Approve access"}</Button>
    </form>

    <div className="relative min-w-0 overflow-x-auto rounded-xl border border-[#e7e7e3] bg-white">
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="sr-only">Approved accounts</caption>
        <thead><tr className="border-b border-[#efefeb] text-[9px] font-800 uppercase tracking-[.14em] text-[#8d8f88]"><th className="px-4 py-3">Member</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Signed in</th><th className="px-4 py-3"><span className="sr-only">Edit</span></th></tr></thead>
        <tbody>{members.map((member) => <tr key={member.id} className="border-b border-[#f3f3f0] last:border-0">
          <td className="px-4 py-3"><p className="font-700">{member.full_name || member.email.split("@")[0]}</p><p className="text-[11px] text-[#8d8f88]">{member.email}</p></td>
          <td className="px-4 py-3 text-xs">{member.role === "owner" ? <Badge tone="review">Owner</Badge> : roleLabel(member.role)}</td>
          <td className="px-4 py-3"><Badge tone={member.status === "active" ? "public" : member.status === "suspended" ? "internal" : "draft"}>{member.status}</Badge></td>
          <td className="px-4 py-3 text-xs text-[#8d8f88]">{member.user_id ? "Linked" : `Invited ${formatDate(member.created_at)}`}</td>
          <td className="px-4 py-3 text-right">{member.role !== "owner" && <button type="button" onClick={() => setEditing(member)} aria-label={`Edit ${member.email}`} className="rounded p-1.5 text-[#8d8f88] hover:bg-[#efefeb] hover:text-[#20211f]"><Pencil size={13} /></button>}</td>
        </tr>)}</tbody>
      </table>
    </div>

    <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit access" description={editing?.email}>
      {editing && <form onSubmit={update} className="space-y-4">
        <TextField label="Full name" name="fullName" defaultValue={editing.full_name} />
        <SelectField label="Role" name="role" defaultValue={editing.role} options={ROLE_OPTIONS} />
        <SelectField label="Status" name="status" defaultValue={editing.status} options={STATUS_OPTIONS} hint="Suspended members lose access immediately." />
        <div className="flex justify-end gap-2 border-t border-[#efefeb] pt-4"><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={pending}>Save</Button></div>
      </form>}
    </Dialog>
  </div>;
}
