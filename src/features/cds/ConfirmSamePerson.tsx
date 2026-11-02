"use client";

import { Button } from "@/components/ui/Button";
import { useMutation } from "@/lib/use-mutation";

// For a CDS talent held for review: the owner confirms it is the dashboard talent
// of the same name, so its photos can be copied to that profile.
export function ConfirmSamePerson({ cdsId, name }: { cdsId: string; name: string }) {
  const { run, pending } = useMutation();
  return <Button size="sm" variant="secondary" disabled={pending}
    onClick={() => { if (window.confirm(`Link this CDS record to the dashboard talent named ${name}? Their CDS photos will be copied to that profile.`)) void run("/api/dashboard/cds/link", { body: { cds_id: cdsId }, success: "Linked. Run the photo copy to bring their photos over." }); }}>Same person: link</Button>;
}
