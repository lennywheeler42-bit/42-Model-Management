import { createServerSupabaseClient } from "@/lib/supabase/server";

export const agencyRoles = [
  "owner",
  "administrator",
  "staff",
  "booker",
  "talent_manager",
  "creative",
  "accounting",
  "read_only",
] as const;

export const ownerManagedRoles = [
  "administrator",
  "staff",
  "booker",
  "talent_manager",
  "creative",
  "accounting",
  "read_only",
] as const;

export type AgencyRole = (typeof agencyRoles)[number];

export const talentManagerRoles: AgencyRole[] = ["owner", "administrator", "talent_manager"];

type AgencyProfile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
};

type AgencyMembership = {
  id: string;
  email: string;
  full_name: string;
  role: AgencyRole;
  status: "active" | "pending" | "suspended";
};

export async function getAgencyContext() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null, membership: null, authorized: false } as const;

  // Membership is bound to the Auth user id by the database (migration 009); the
  // profile row is only a mirror and is never used for authorization.
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("id,email,full_name,role,status").eq("id", user.id).maybeSingle(),
    supabase.from("agency_members").select("id,email,full_name,role,status").eq("user_id", user.id).maybeSingle(),
  ]);

  const typedProfile = profile as AgencyProfile | null;
  const typedMembership = membership as AgencyMembership | null;
  const authorized = Boolean(typedMembership?.status === "active" && agencyRoles.includes(typedMembership.role));

  return { supabase, user, profile: typedProfile, membership: typedMembership, authorized } as const;
}

export async function getOwnerContext() {
  const context = await getAgencyContext();
  return context.authorized && context.membership?.role === "owner" ? context : null;
}

export function displayNameForUser(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }, profile?: { full_name?: string | null } | null) {
  return profile?.full_name ||
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") ||
    (typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "") ||
    user.email?.split("@")[0] ||
    "Agency user";
}

export function canManageTalent(role: AgencyRole | string | null | undefined) {
  return Boolean(role && talentManagerRoles.includes(role as AgencyRole));
}
