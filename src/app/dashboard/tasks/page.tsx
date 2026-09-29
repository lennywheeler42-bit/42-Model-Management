import { ModulePlaceholder } from "@/features/dashboard/ModulePlaceholder";

export const metadata = { title: "Tasks" };

export default function TasksPage() {
  return <ModulePlaceholder href="/dashboard/tasks" description="Agency to-dos and follow-ups assigned to staff." />;
}
