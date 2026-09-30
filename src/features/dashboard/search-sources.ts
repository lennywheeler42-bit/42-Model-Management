import type { SupabaseClient } from "@supabase/supabase-js";
import type { Permission } from "@/lib/permissions";

// Global dashboard search. Each record type is a source with its own permission;
// sources the viewer cannot use are skipped entirely (RLS would hide the rows
// anyway, this just avoids empty queries). Add new record types here.
export type SearchHit = { id: string; href: string; title: string; subtitle?: string; badge?: string };
export type SearchSource = { key: string; title: string; permission: Permission; wide?: boolean; run: (supabase: SupabaseClient, q: string) => Promise<SearchHit[]> };

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

export const searchSources: SearchSource[] = [
  {
    key: "talent", title: "Talent", permission: "talent.view", wide: true,
    run: async (supabase, q) => {
      const { data, error } = await supabase.from("talent").select("id,display_name,talent_id,location,publication_status")
        .or(`display_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,talent_id.ilike.%${q}%,location.ilike.%${q}%`)
        .order("display_name").limit(25);
      if (error) throw error;
      return data.map((row) => ({ id: row.id, href: `/dashboard/talent/${row.id}`, title: row.display_name, subtitle: join(row.talent_id, row.location), badge: row.publication_status }));
    },
  },
  {
    key: "applications", title: "Applications", permission: "applications.view",
    run: async (supabase, q) => {
      const { data, error } = await supabase.from("applications").select("id,first_name,last_name,email,city,status")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,city.ilike.%${q}%`)
        .order("submitted_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data.map((row) => ({ id: row.id, href: `/dashboard/applications/${row.id}`, title: join(row.first_name, row.last_name) || row.email || "Applicant", subtitle: join(row.email, row.city), badge: row.status }));
    },
  },
  {
    key: "boards", title: "Boards", permission: "boards.view",
    run: async (supabase, q) => {
      const { data, error } = await supabase.from("boards").select("id,name,slug,is_active").or(`name.ilike.%${q}%,slug.ilike.%${q}%`).order("name").limit(10);
      if (error) throw error;
      return data.map((row) => ({ id: row.id, href: `/dashboard/talent?board=${row.id}`, title: row.name, subtitle: row.is_active ? undefined : "inactive" }));
    },
  },
];
