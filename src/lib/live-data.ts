import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { heightLabel, lengthLabel } from "@/lib/format";
import type { Talent } from "@/lib/data";

// Reads the public-safe views from migration 017 as the anonymous role.
type BoardRef = { id: string; name: string; slug: string; path: string; sort_order: number | null };

type TalentRow = {
  id: string;
  slug: string;
  display_name: string;
  location: string | null;
  gender: string | null;
  age: number | null;
  featured: boolean;
  public_bio: string | null;
  primary_image_path: string | null;
  height_cm: number | null;
  bust_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  shoe_size: string | null;
  eye_color: string | null;
  hair_color: string | null;
  boards: BoardRef[] | null;
  board_paths: string[] | null;
};

const placeholder = "/placeholder-talent.svg";

function mediaUrl(supabase: SupabaseClient, path: string | null) {
  if (!path) return placeholder;
  return supabase.storage.from("talent-public").getPublicUrl(path).data.publicUrl;
}

function toTalent(supabase: SupabaseClient, row: TalentRow, boardPath?: string): Talent {
  const boards = row.boards ?? [];
  const board = (boardPath && boards.find((item) => item.path === boardPath)) || boards[0];
  const [firstName, ...rest] = row.display_name.split(" ");
  const height = heightLabel(row.height_cm);
  return {
    id: row.id,
    slug: row.slug,
    name: row.display_name,
    firstName,
    lastName: rest.join(" "),
    location: row.location ?? "",
    board: board?.name ?? "",
    boardSlug: board?.path ?? "",
    gender: row.gender ?? "",
    age: row.age ?? 0,
    height: height ? height.split(" / ")[0] : "—",
    stats: [],
    image: mediaUrl(supabase, row.primary_image_path),
    gallery: [],
    tags: [],
    status: "published",
    featured: row.featured,
    showOnWebsite: true,
    bio: row.public_bio ?? "",
  };
}

// Roster listing: public talent on at least one public board, optionally one board.
export async function getPublicTalents(boardPath?: string) {
  const supabase = createPublicSupabaseClient();
  let query = supabase.from("public_talents_view").select("*").neq("board_paths", "{}").order("featured", { ascending: false }).order("display_name");
  if (boardPath) query = query.contains("board_paths", [boardPath]);
  const { data, error } = await query;
  if (error) {
    console.error("Public talent query failed", error.code, error.message);
    return [];
  }
  return ((data ?? []) as TalentRow[]).map((row) => toTalent(supabase, row, boardPath));
}

export async function getPublicTalent(slug: string) {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.from("public_talents_view").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) {
    if (error) console.error("Public talent profile query failed", error.code, error.message);
    return null;
  }
  const row = data as TalentRow;
  const media = await supabase.from("public_talent_media_view").select("image_path").eq("talent_id", row.id).eq("media_type", "image").order("display_order");
  const images = ((media.data ?? []) as { image_path: string | null }[]).filter((item) => item.image_path);
  const stats = [
    ["Height", heightLabel(row.height_cm)],
    ["Bust / Chest", lengthLabel(row.bust_cm)],
    ["Waist", lengthLabel(row.waist_cm)],
    ["Hips", lengthLabel(row.hips_cm)],
    ["Shoe", row.shoe_size],
    ["Eyes", row.eye_color],
    ["Hair", row.hair_color],
  ].filter(([, value]) => value).map(([label, value]) => ({ label: label as string, value: value as string }));

  return {
    ...toTalent(supabase, row),
    bio: row.public_bio || "Represented by 42 Model Management.",
    stats,
    gallery: images.map((item) => mediaUrl(supabase, item.image_path)),
  } satisfies Talent;
}
