import { NextResponse } from "next/server";
import { databaseError, writeAudit } from "@/lib/api";
import { z } from "zod";
import { canManageTalent, getAgencyContext } from "@/lib/agency-auth";

const nullableText = z.string().trim().max(240).optional().nullable();

const updateSchema = z.object({
  first_name: z.string().trim().min(1).max(80).optional(),
  last_name: z.string().trim().min(1).max(80).optional(),
  display_name: z.string().trim().min(1).max(160).optional(),
  location: nullableText,
  gender: nullableText,
  date_of_birth: z.string().trim().max(20).optional().nullable(),
  date_joined: z.string().trim().max(20).optional().nullable(),
  birth_place: nullableText,
  nationality: nullableText,
  mobile: nullableText,
  phone: nullableText,
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  website: nullableText,
  is_minor: z.boolean().optional(),
  allow_sms: z.boolean().optional(),
  email_icalendar: nullableText,
  username: nullableText,
  talent_login_enabled: z.boolean().optional(),
  talent_app_enabled: z.boolean().optional(),
  minimum_tariff: z.coerce.number().nonnegative().optional().nullable(),
  minimum_hourly_rate: z.coerce.number().nonnegative().optional().nullable(),
  minimum_day_rate: z.coerce.number().nonnegative().optional().nullable(),
  public_bio: z.string().trim().max(5000).optional().nullable(),
  publication_status: z.enum(["draft", "review", "published", "archived"]).optional(),
  show_on_website: z.boolean().optional(),
  show_in_search: z.boolean().optional(),
  featured: z.boolean().optional(),
  board_id: z.string().uuid().optional().nullable(),
}).refine((value) => Object.keys(value).length > 0);

function maskValue(value: unknown) {
  if (typeof value !== "string" || !value) return value;
  return value.length <= 4 ? "••••" : `•••• ${value.slice(-4)}`;
}

// Account identifiers are never sent to the browser in full.
function maskBanking(banking: Record<string, unknown> | null) {
  if (!banking) return banking;
  return { ...banking, account_number: maskValue(banking.account_number), routing_number: maskValue(banking.routing_number), swift_aba: maskValue(banking.swift_aba) };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getAgencyContext();
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.authorized) return NextResponse.json({ error: "Your account is not approved for the agency dashboard" }, { status: 403 });

  const [talentResult, assignmentsResult, measurementsResult, detailsResult, notesResult, contactsResult, addressesResult, skillsResult, socialsResult, mediaResult, legalResult, bankingResult, agenciesResult, documentsResult, itemsResult, usagesResult, appointmentsResult, medicalResult] = await Promise.all([
    context.supabase.from("talent").select("*").eq("id", id).maybeSingle(),
    context.supabase.from("talent_board_assignments").select("board_id,boards(id,name,slug)").eq("talent_id", id),
    context.supabase.from("talent_measurements").select("*").eq("talent_id", id).order("measured_on", { ascending: false }),
    context.supabase.from("talent_private_details").select("notes").eq("talent_id", id).maybeSingle(),
    context.supabase.from("talent_notes").select("id,note_type,body,created_at").eq("talent_id", id).order("created_at", { ascending: false }),
    context.supabase.from("talent_contacts").select("*").eq("talent_id", id).order("created_at"),
    context.supabase.from("talent_addresses").select("*").eq("talent_id", id).order("created_at"),
    context.supabase.from("talent_skills").select("*").eq("talent_id", id).order("category,skill"),
    context.supabase.from("talent_social_accounts").select("*").eq("talent_id", id).order("platform"),
    context.supabase.from("talent_photos").select("id,storage_path,title,alt_text,photographer,image_type,display_order,featured,public,publish_to_website").eq("talent_id", id).is("archived_at", null).order("display_order"),
    context.supabase.from("talent_legal").select("*").eq("talent_id", id).maybeSingle(),
    context.supabase.from("talent_banking").select("*").eq("talent_id", id).maybeSingle(),
    context.supabase.from("talent_agencies").select("*").eq("talent_id", id).order("created_at"),
    context.supabase.from("talent_documents").select("id,file_name,description,category,visibility,created_at").eq("talent_id", id).order("created_at", { ascending: false }),
    context.supabase.from("talent_items").select("*").eq("talent_id", id).order("created_at", { ascending: false }),
    context.supabase.from("talent_usages").select("*").eq("talent_id", id).order("start_date", { ascending: false }),
    context.supabase.from("talent_appointments").select("*").eq("talent_id", id).order("start_at", { ascending: false }),
    context.supabase.from("talent_medical").select("*").eq("talent_id", id).maybeSingle(),
  ]);
  const failed = [talentResult, assignmentsResult, measurementsResult, detailsResult, notesResult, contactsResult, addressesResult, skillsResult, socialsResult, mediaResult, legalResult, bankingResult, agenciesResult, documentsResult, itemsResult, usagesResult, appointmentsResult, medicalResult].find((result) => result.error);
  if (failed?.error) return databaseError(failed.error, "update the talent record");
  if (!talentResult.data) return NextResponse.json({ error: "Talent not found" }, { status: 404 });

  // RLS already returns null for roles without access; log when restricted data was actually returned.
  const sensitiveModules = [["legal", legalResult.data], ["banking", bankingResult.data], ["medical", medicalResult.data]].filter(([, value]) => value).map(([name]) => name);
  if (sensitiveModules.length) await writeAudit(context.supabase, { action: "sensitive.viewed", entityType: "talent", entityId: id, metadata: { modules: sensitiveModules } });

  return NextResponse.json({
    talent: talentResult.data,
    boards: (assignmentsResult.data ?? []).map((assignment) => ({ boardId: assignment.board_id, board: Array.isArray(assignment.boards) ? assignment.boards[0] : assignment.boards })),
    measurements: measurementsResult.data ?? [],
    details: detailsResult.data ?? { notes: "" },
    notes: notesResult.data ?? [],
    contacts: contactsResult.data ?? [],
    addresses: addressesResult.data ?? [],
    skills: skillsResult.data ?? [],
    socialAccounts: socialsResult.data ?? [],
    media: mediaResult.data ?? [],
    legal: legalResult.data,
    banking: maskBanking(bankingResult.data),
    agencies: agenciesResult.data ?? [],
    documents: documentsResult.data ?? [],
    items: itemsResult.data ?? [],
    usages: usagesResult.data ?? [],
    appointments: appointmentsResult.data ?? [],
    medical: medicalResult.data,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getAgencyContext();
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.authorized) return NextResponse.json({ error: "Your account is not approved for the agency dashboard" }, { status: 403 });
  if (!canManageTalent(context.membership?.role)) return NextResponse.json({ error: "Talent management access required" }, { status: 403 });

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid talent update" }, { status: 400 });
  const { board_id, ...talentFields } = parsed.data;
  const update = { ...talentFields, updated_by: context.user.id, updated_at: new Date().toISOString() };
  const { data, error } = await context.supabase.from("talent").update(update).eq("id", id).select("*").single();
  if (error) return databaseError(error, "update the talent record");

  if (board_id !== undefined) {
    await context.supabase.from("talent_board_assignments").delete().eq("talent_id", id);
    if (board_id) {
      const assignment = await context.supabase.from("talent_board_assignments").insert({ talent_id: id, board_id });
      if (assignment.error) return databaseError(assignment.error, "update the talent record");
    }
  }

  // Field names only: values such as DOB and phone numbers stay out of the audit log.
  await writeAudit(context.supabase, { action: board_id !== undefined ? "talent.edited_with_board_change" : "talent.edited", entityType: "talent", entityId: id, metadata: { fields: Object.keys(parsed.data), board_id: board_id ?? null } });
  return NextResponse.json(data);
}
