import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ToastProvider } from "@/components/ui/Toast";
import { DashboardFrame } from "@/features/dashboard/DashboardFrame";
import { visibleNav } from "@/features/dashboard/nav";
import { displayNameForUser, getAgencyContext } from "@/lib/agency-auth";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s — Agency OS" },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const context = await getAgencyContext();
  if (!context.user) redirect("/login?next=/dashboard");
  if (!context.authorized || !context.membership) redirect("/login?error=not_authorized");

  const viewer = {
    name: displayNameForUser(context.user, context.profile),
    email: context.user.email ?? "",
    role: context.membership.role,
    avatarUrl: typeof context.user.user_metadata?.avatar_url === "string" ? context.user.user_metadata.avatar_url : null,
  };

  return <ToastProvider><DashboardFrame nav={visibleNav(context.permissions)} viewer={viewer}>{children}</DashboardFrame></ToastProvider>;
}
