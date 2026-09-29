import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    const email = user.email?.toLowerCase();
    const [{ data: profile }, { data: membership }] = await Promise.all([
      supabase.from("profiles").select("status").eq("id", user.id).maybeSingle(),
      email ? supabase.from("agency_members").select("status").eq("email", email).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    if (profile?.status !== "active" || membership?.status !== "active") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("error", "not_authorized");
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}
