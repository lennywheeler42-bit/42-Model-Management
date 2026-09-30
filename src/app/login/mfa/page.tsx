import { redirect } from "next/navigation";
import { safePath } from "@/lib/safe-path";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AuthShell } from "../AuthShell";
import { MfaForm } from "./MfaForm";

export const metadata = { title: "Two-step sign-in", robots: { index: false } };

// Owner and administrator accounts reach this page only when they have not
// signed in with Google in the last 30 days (see src/lib/mfa-policy.ts). Linked
// Google accounts are offered "Continue with Google" first; otherwise a TOTP
// code from an authenticator app (first visit sets it up).
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const next = safePath((await searchParams).next, "/dashboard");
  const google = ((user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider]).includes("google");
  const intro = google
    ? "Your role can see sensitive talent data. Please confirm it's you: continue with Google again, or enter a code from an authenticator app."
    : "Your role can see sensitive talent data, so this sign-in needs a code from an authenticator app (Google Authenticator, 1Password, Authy, Microsoft Authenticator…). Signing in with Google skips this step.";
  return <AuthShell eyebrow="Security" title="Confirm it's you." intro={intro}>
    <MfaForm next={next} email={user.email ?? ""} google={google} />
  </AuthShell>;
}
