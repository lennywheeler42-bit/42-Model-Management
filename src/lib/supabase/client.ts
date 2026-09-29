import { createBrowserClient } from "@supabase/ssr";

// Browser client: publishable key only, so every request is subject to RLS.
// NEXT_PUBLIC_* values must be referenced literally for Next.js to inline them.
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
