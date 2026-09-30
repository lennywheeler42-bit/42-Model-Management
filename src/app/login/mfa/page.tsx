import { redirect } from "next/navigation";
import { safePath } from "@/lib/safe-path";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AuthShell } from "../AuthShell";
import { MfaForm } from "./MfaForm";

export const metadata = { title: "Two-step sign-in", robots: { index: false } };

// Owner and administrator accounts complete a TOTP code (authenticator app)
// before using the dashboard. First visit sets it up.
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const next = safePath((await searchParams).next, "/dashboard");
  return <AuthShell eyebrow="Security" title="Two-step sign-in." intro="Your role can see sensitive talent data, so every sign-in needs a code from an authenticator app (Google Authenticator, 1Password, Authy, Microsoft Authenticator…).">
    <MfaForm next={next} email={user.email ?? ""} />
  </AuthShell>;
}
