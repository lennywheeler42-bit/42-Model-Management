import { NextResponse } from "next/server";
import { databaseError } from "@/lib/api";
import { requireApi } from "@/lib/agency-auth";

// Stops one emailed link working. The record of the email is kept.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; emailId: string }> }) {
  const { id, emailId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(emailId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const auth = await requireApi("packages.manage");
  if ("response" in auth) return auth.response;
  const { data, error } = await auth.context.supabase.from("package_emails").update({ revoked_at: new Date().toISOString() })
    .eq("id", emailId).eq("package_id", id).is("revoked_at", null).select("id");
  if (error) return databaseError(error, "stop the link");
  if (!data?.length) return NextResponse.json({ error: "This link is already stopped." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
