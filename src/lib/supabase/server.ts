import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always write cookies; middleware owns refresh persistence.
        }
      },
    },
  });
}

