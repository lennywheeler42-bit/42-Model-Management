import { ModulePlaceholder } from "@/features/dashboard/ModulePlaceholder";

export const metadata = { title: "Finance" };

export default function FinancePage() {
  return <ModulePlaceholder href="/dashboard/finance" description="Invoicing, statements, and talent payments." />;
}
