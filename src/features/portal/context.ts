import "server-only";
import { cache } from "react";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// The signed-in talent and their allow-listed profile (portal_profile()). A
// staff account or an unlinked login gets null: it has no portal profile.
export type PortalProfile = {
  id: string; display_name: string; first_name: string; last_name: string; location: string | null; gender: string | null;
  is_minor: boolean; slug: string; live_on_website: boolean;
  contact: { email: string | null; mobile: string | null; phone: string | null; date_of_birth: string | null } | null;
  address: { address_1: string | null; address_2: string | null; city: string | null; state: string | null; postal_code: string | null; country: string | null } | null;
  measurements: { height_cm: number | null; bust_cm: number | null; waist_cm: number | null; hips_cm: number | null; shoe_size: string | null; hair_color: string | null; eye_color: string | null; measured_on: string | null } | null;
  instagram: string | null;
  boards: string[];
};

export const getPortal = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc("portal_profile");
  if (error || !data) return null;
  return { supabase, user, profile: data as PortalProfile };
});

export async function requirePortal() {
  const portal = await getPortal();
  if (!portal) redirect("/portal/login?error=not_invited");
  return portal;
}

export async function requirePortalApi(): Promise<{ portal: NonNullable<Awaited<ReturnType<typeof getPortal>>> } | { response: NextResponse }> {
  const portal = await getPortal();
  if (!portal) return { response: NextResponse.json({ error: "Please sign in to the talent portal" }, { status: 401 }) };
  return { portal };
}
