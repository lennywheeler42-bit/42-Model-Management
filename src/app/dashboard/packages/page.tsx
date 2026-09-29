import { ModulePlaceholder } from "@/features/dashboard/ModulePlaceholder";

export const metadata = { title: "Packages" };

export default function PackagesPage() {
  return <ModulePlaceholder href="/dashboard/packages" description="Curated talent packages to share with clients." />;
}
