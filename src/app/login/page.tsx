import { safePath } from "@/lib/safe-path";
import { AuthShell } from "./AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

const errors: Record<string, string> = {
  not_authorized: "This email is not approved for the agency dashboard. Ask the owner to add it under Team access.",
  oauth_callback_failed: "Sign-in could not be completed. Please try again.",
  link_expired: "That link has expired or was already used. Request a new one below.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; reset?: string }> }) {
  const params = await searchParams;
  const nextPath = safePath(params.next, "/dashboard");
  return <AuthShell eyebrow="Private workspace" title="Welcome back." intro="Sign in with your agency account to manage talent, media, boards, and publishing.">
    <LoginForm nextPath={nextPath} initialError={errors[params.error ?? ""] ?? ""} initialNotice={params.reset === "done" ? "Your password was updated. Sign in with the new password." : ""} />
  </AuthShell>;
}
