import { ErrorState, UnauthorizedState } from "@/components/ui/States";
import { displayNameForUser, requirePage } from "@/lib/agency-auth";
import { loadOverview } from "@/features/dashboard/overview";
import { OverviewView, type OverviewData } from "@/features/dashboard/OverviewView";

export const metadata = { title: "Dashboard" };

export default async function DashboardHome() {
  const context = await requirePage("dashboard.access");
  if (!context) return <UnauthorizedState />;

  let data: OverviewData;
  try {
    data = await loadOverview(context.supabase, context.permissions);
  } catch (error) {
    console.error("[dashboard] overview failed", error);
    return <ErrorState title="The dashboard could not be loaded" />;
  }
  return <OverviewView name={displayNameForUser(context.user, context.profile).split(" ")[0]} permissions={context.permissions} data={data} />;
}
