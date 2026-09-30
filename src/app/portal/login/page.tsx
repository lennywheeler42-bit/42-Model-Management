import { AuthShell } from "@/app/login/AuthShell";
import { PortalLoginForm } from "@/features/portal/components/PortalLoginForm";

export const metadata = { title: "Talent portal", robots: { index: false } };

const errors: Record<string, string> = {
  not_invited: "This email is not linked to a talent profile yet. Ask your agent to invite you to the portal.",
  link_expired: "That sign-in link has expired or was already used. Request a new one below.",
};

export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthShell eyebrow="Talent portal" title="Your 42 profile." intro="Sign in with the email your agent invited. We will send you a one-time sign-in link — no password needed.">
    <PortalLoginForm initialError={errors[error ?? ""] ?? ""} />
  </AuthShell>;
}
