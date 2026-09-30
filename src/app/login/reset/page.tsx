import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AuthShell } from "../AuthShell";
import { ResetForm } from "./ResetForm";

export const metadata = { title: "Choose a new password", robots: { index: false } };

// Reached from the reset email via /auth/callback, which signs the user in first.
export default async function ResetPasswordPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=link_expired");
  return <AuthShell eyebrow="Account recovery" title="Choose a new password." intro={`For ${user.email ?? "your account"}. Use at least 10 characters; a passphrase is easiest to remember.`}>
    <ResetForm />
  </AuthShell>;
}
