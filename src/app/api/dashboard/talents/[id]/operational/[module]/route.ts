import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgencyContext, type AgencyRole } from "@/lib/agency-auth";

const text = (max = 240) => z.string().trim().max(max).optional().default("");
const date = z.string().trim().max(40).optional().default("").transform((value) => value || null);

const schemas = {
  legal: z.object({ contract_name: text(160), company_name: text(160), tax_number: text(120), work_permit_country: text(120), contract_expires_on: date }),
  banking: z.object({ description: text(500), contact: text(160), account_name: text(160), account_number: text(120), routing_number: text(120), swift_aba: text(120) }),
  agencies: z.object({ agency_name: z.string().trim().min(1).max(160), country: text(120), city: text(120), phone: text(80), placement: text(160), start_date: date, end_date: date }),
  documents: z.object({ file_name: z.string().trim().min(1).max(240), storage_path: z.string().trim().min(1).max(500), description: text(1000), category: text(80), visibility: z.enum(["private", "staff", "public"]).default("private") }),
  items: z.object({ item_type: z.string().trim().min(1).max(120), description: text(500), size: text(80), condition: text(80), status: text(40) }),
  usages: z.object({ event_type: text(120), usage_type: text(120), client: text(160), product: text(160), start_date: date, end_date: date, booker: text(160), exclusivity: text(120), board: text(120), notes: text(2000) }),
  appointments: z.object({ event_type: text(120), job_type: text(120), client: text(160), product: text(160), start_at: date, end_at: date, status: text(40), booker: text(160), board: text(120), notes: text(2000) }),
  medical: z.object({ doctor: text(160), office_address: text(240), office_phone: text(80), last_visit: date, medical_approval: text(120), valid_through: date, availability: text(120) }),
};

const tableByModule = {
  legal: { table: "talent_legal", single: true, roles: ["owner", "administrator", "accounting"] },
  banking: { table: "talent_banking", single: true, roles: ["owner", "administrator", "accounting"] },
  agencies: { table: "talent_agencies", single: false, roles: ["owner", "administrator", "talent_manager"] },
  documents: { table: "talent_documents", single: false, roles: ["owner", "administrator", "talent_manager", "accounting"] },
  items: { table: "talent_items", single: false, roles: ["owner", "administrator", "talent_manager"] },
  usages: { table: "talent_usages", single: false, roles: ["owner", "administrator", "booker", "talent_manager"] },
  appointments: { table: "talent_appointments", single: false, roles: ["owner", "administrator", "booker", "talent_manager"] },
  medical: { table: "talent_medical", single: true, roles: ["owner", "administrator", "talent_manager"] },
} as const;

type OperationalModule = keyof typeof schemas;
type TableResult = { data: Record<string, unknown> | null; error: { message: string } | null };
type TableClient = {
  insert(values: Record<string, unknown>): { select(columns: string): { single(): Promise<TableResult> } };
  upsert(values: Record<string, unknown>, options: { onConflict: string }): { select(columns: string): { single(): Promise<TableResult> } };
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string; module: string }> }) {
  const { id, module } = await params;
  if (!(module in schemas) || !(module in tableByModule)) return NextResponse.json({ error: "Unsupported talent module" }, { status: 404 });
  const operationalModule = module as OperationalModule;
  const config = tableByModule[operationalModule];
  const context = await getAgencyContext();
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.authorized) return NextResponse.json({ error: "Your account is not approved for the agency dashboard" }, { status: 403 });
  if (!context.membership?.role || !(config.roles as readonly string[]).includes(context.membership.role as AgencyRole)) return NextResponse.json({ error: "You do not have access to this talent module" }, { status: 403 });

  const parsed = schemas[operationalModule].safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please complete the required fields" }, { status: 400 });
  const payload = { talent_id: id, ...parsed.data };
  const table = context.supabase.from(config.table as never) as unknown as TableClient;
  const query = config.single
    ? table.upsert(payload, { onConflict: "talent_id" }).select("*").single()
    : table.insert(payload).select("*").single();
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "The record could not be saved" }, { status: 500 });
  await context.supabase.from("audit_log").insert({ table_name: config.table, record_id: data.id ?? id, action: config.single ? "upsert" : "create", changed_by: context.user.id, new_data: { talent_id: id } });
  return NextResponse.json(data, { status: config.single ? 200 : 201 });
}
