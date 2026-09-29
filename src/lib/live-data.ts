import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Talent } from "@/lib/data";

type DirectoryRow = {
  id: string;
  slug: string;
  talent_id: string;
  display_name: string;
  location: string | null;
  gender: string | null;
  date_of_birth: string | null;
  featured: boolean;
  board_name: string | null;
  board_slug: string | null;
  primary_image_path: string | null;
};

type ProfileRow = DirectoryRow & {
  first_name: string;
  last_name: string;
  boards: { name: string; slug: string }[] | null;
  height_cm: number | null;
  bust_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  shoe_size: string | null;
  eye_color: string | null;
  hair_color: string | null;
  gallery: { storage_path: string; title: string | null; alt_text: string | null; display_order: number }[] | null;
};

const placeholder = "/placeholder-talent.svg";

function ageFromDate(date: string | null) {
  if (!date) return 0;
  const today = new Date();
  const dob = new Date(`${date}T00:00:00`);
  let age = today.getFullYear() - dob.getFullYear();
  const month = today.getMonth() - dob.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < dob.getDate())) age -= 1;
  return Math.max(age, 0);
}

function mediaUrl(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, path: string | null) {
  if (!path) return placeholder;
  if (path.startsWith("http")) return path;
  return supabase.storage.from("talent-public").getPublicUrl(path).data.publicUrl;
}

function toTalent(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, row: DirectoryRow): Talent {
  return {
    id: row.id,
    slug: row.slug,
    name: row.display_name,
    firstName: row.display_name.split(" ")[0] ?? row.display_name,
    lastName: row.display_name.split(" ").slice(1).join(" "),
    location: row.location ?? "",
    board: row.board_name ?? "Unassigned",
    boardSlug: row.board_slug ?? "",
    gender: row.gender ?? "",
    age: ageFromDate(row.date_of_birth),
    height: "—",
    stats: [],
    image: mediaUrl(supabase, row.primary_image_path),
    gallery: [],
    tags: [],
    status: "published",
    featured: row.featured,
    showOnWebsite: true,
    bio: "",
  };
}

export async function getPublicTalents(boardSlug?: string) {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("public_talent_directory").select("*").order("display_name");
  if (boardSlug) query = query.eq("board_slug", boardSlug);
  const { data, error } = await query;
  if (error) {
    console.error("Public talent query failed", error);
    return [];
  }
  const unique = new Map<string, DirectoryRow>();
  for (const row of (data ?? []) as DirectoryRow[]) unique.set(`${row.id}:${row.board_slug ?? ""}`, row);
  return [...unique.values()].map((row) => toTalent(supabase, row));
}

export async function getPublicTalent(slug: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("public_talent_profiles").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) {
    if (error) console.error("Public talent profile query failed", error);
    return null;
  }
  const row = data as ProfileRow;
  const boards = row.boards ?? [];
  const board = boards[0];
  const stats = [
    ["Height", row.height_cm ? `${Math.round(row.height_cm / 2.54 / 12)}' ${Math.round((row.height_cm / 2.54) % 12)}\" / ${row.height_cm} cm` : "—"],
    ["Bust / Chest", row.bust_cm ? `${row.bust_cm} cm` : "—"],
    ["Waist", row.waist_cm ? `${row.waist_cm} cm` : "—"],
    ["Hips", row.hips_cm ? `${row.hips_cm} cm` : "—"],
    ["Shoe", row.shoe_size ?? "—"],
    ["Eyes", row.eye_color ?? "—"],
    ["Hair", row.hair_color ?? "—"],
  ].map(([label, value]) => ({ label, value }));
  return {
    ...toTalent(supabase, { ...row, board_name: board?.name ?? null, board_slug: board?.slug ?? null }),
    firstName: row.first_name,
    lastName: row.last_name,
    bio: "Approved talent profile managed by 42 Model Management.",
    stats,
    gallery: (row.gallery ?? []).map((item) => mediaUrl(supabase, item.storage_path)),
    board: board?.name ?? "Unassigned",
    boardSlug: board?.slug ?? "",
  } satisfies Talent;
}

