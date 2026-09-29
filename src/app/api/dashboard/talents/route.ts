import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageTalent, getAgencyContext } from "@/lib/agency-auth";

const createTalentSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  location: z.string().trim().max(120).optional().default(""),
  gender: z.string().trim().max(40).optional().default(""),
  boardSlug: z.string().trim().min(1).max(120),
  displayName: z.string().trim().max(160).optional().default(""),
  dateOfBirth: z.string().trim().max(20).optional().default(""),
  dateJoined: z.string().trim().max(20).optional().default(""),
  birthPlace: z.string().trim().max(120).optional().default(""),
  nationality: z.string().trim().max(120).optional().default(""),
  mobile: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().max(80).optional().default(""),
  email: z.string().trim().email().optional().or(z.literal("")),
  website: z.string().trim().max(240).optional().default(""),
  isMinor: z.boolean().optional().default(false),
  allowSms: z.boolean().optional().default(false),
  publicBio: z.string().trim().max(5000).optional().default(""),
  minimumTariff: z.coerce.number().nonnegative().optional().nullable(),
  minimumHourlyRate: z.coerce.number().nonnegative().optional().nullable(),
  minimumDayRate: z.coerce.number().nonnegative().optional().nullable(),
});

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET() {
  const context = await getAgencyContext();
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.authorized) return NextResponse.json({ error: "Your account is not approved for the agency dashboard" }, { status: 403 });
  if (!canManageTalent(context.membership?.role)) return NextResponse.json({ error: "Talent management access required" }, { status: 403 });
  const { supabase } = context;

  const { data, error } = await supabase
    .from("talent")
    .select("id,talent_id,slug,first_name,last_name,display_name,location,publication_status,show_on_website,featured,updated_at")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data ?? []).map((talent) => talent.id);
  const assignments = ids.length ? await supabase.from("talent_board_assignments").select("talent_id,boards(name,slug)").in("talent_id", ids) : { data: [], error: null };
  if (assignments.error) return NextResponse.json({ error: assignments.error.message }, { status: 500 });

  const boardMap = new Map<string, { name: string; slug: string }>();
  for (const assignment of assignments.data ?? []) {
    const board = Array.isArray(assignment.boards) ? assignment.boards[0] : assignment.boards;
    if (board && !boardMap.has(assignment.talent_id)) boardMap.set(assignment.talent_id, board as { name: string; slug: string });
  }

  return NextResponse.json((data ?? []).map((talent) => ({
    id: talent.id,
    slug: talent.slug,
    name: talent.display_name,
    firstName: talent.first_name,
    lastName: talent.last_name,
    location: talent.location ?? "",
    board: boardMap.get(talent.id)?.name ?? "Unassigned",
    boardSlug: boardMap.get(talent.id)?.slug ?? "",
    gender: "",
    age: 0,
    height: "—",
    stats: [],
    image: "/placeholder-talent.svg",
    gallery: [],
    tags: [],
    status: talent.publication_status,
    featured: talent.featured,
    showOnWebsite: talent.show_on_website,
    bio: "",
    talentId: talent.talent_id,
  })));
}

export async function POST(request: Request) {
  const context = await getAgencyContext();
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.authorized) return NextResponse.json({ error: "Your account is not approved for the agency dashboard" }, { status: 403 });
  const { supabase, user } = context;

  const parsed = createTalentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please provide valid talent details" }, { status: 400 });

  const { firstName, lastName, location, gender, boardSlug, displayName, dateOfBirth, dateJoined, birthPlace, nationality, mobile, phone, email, website, isMinor, allowSms, publicBio, minimumTariff, minimumHourlyRate, minimumDayRate } = parsed.data;
  const baseSlug = slugify(displayName || `${firstName}-${lastName}`);
  const slug = `${baseSlug || "talent"}-${Date.now().toString(36).slice(-6)}`;
  const talentId = `T-${Date.now().toString(36).toUpperCase().slice(-7)}`;
  const { data: board, error: boardError } = await supabase.from("boards").select("id").eq("slug", boardSlug).maybeSingle();
  if (boardError || !board) return NextResponse.json({ error: "Selected board was not found" }, { status: 400 });

  const { data: talent, error } = await supabase.from("talent").insert({
    slug,
    talent_id: talentId,
    first_name: firstName,
    last_name: lastName,
    display_name: displayName || `${firstName} ${lastName}`,
    location,
    gender,
    date_of_birth: dateOfBirth || null,
    date_joined: dateJoined || null,
    birth_place: birthPlace,
    nationality,
    mobile,
    phone,
    email: email || null,
    website,
    is_minor: isMinor,
    allow_sms: allowSms,
    public_bio: publicBio,
    minimum_tariff: minimumTariff ?? null,
    minimum_hourly_rate: minimumHourlyRate ?? null,
    minimum_day_rate: minimumDayRate ?? null,
    publication_status: "draft",
    show_on_website: false,
    created_by: user.id,
    updated_by: user.id,
  }).select("id,talent_id,slug,first_name,last_name,display_name,location,gender,date_of_birth,date_joined,birth_place,nationality,mobile,phone,email,website,is_minor,allow_sms,public_bio,minimum_tariff,minimum_hourly_rate,minimum_day_rate,publication_status,show_on_website,featured").single();
  if (error || !talent) return NextResponse.json({ error: error?.message ?? "Unable to create talent" }, { status: 500 });

  const assignment = await supabase.from("talent_board_assignments").insert({ talent_id: talent.id, board_id: board.id, created_at: new Date().toISOString() });
  if (assignment.error) return NextResponse.json({ error: assignment.error.message }, { status: 500 });

  await supabase.from("audit_log").insert({ table_name: "talent", record_id: talent.id, action: "create", changed_by: user.id, new_data: { slug } });
  return NextResponse.json({ ...talent, status: "draft", showOnWebsite: false }, { status: 201 });
}
