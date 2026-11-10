// Pure queue rules for the GHL sync, so they are unit-tested directly
// (tests/unit/ghl-sync.test.mts). The engine applies them with the secret key.

export type FailedJob = { id: string; kind: "contact" | "push_contact"; external_id: string; status: "failed" | "dead" };

// "Retry failed": what to queue again and which rows to close.
//
// Only one job per record may be open (ghl_sync_jobs_open_idx), but a record can
// leave several stopped ("dead") jobs behind, one for each time it was queued and
// gave up. Re-opening those rows directly breaks that rule and the database refuses
// the whole change, so nothing was retried. Instead each record is queued once, as
// one job, and every stopped row is closed. A "failed" row is the record's open job
// already: it is kept, and only starts again from the first attempt.
export function retryPlan(jobs: FailedJob[]) {
  const queue = new Map<FailedJob["kind"], Set<string>>();
  for (const job of jobs) queue.set(job.kind, (queue.get(job.kind) ?? new Set<string>()).add(job.external_id));
  return {
    queue: [...queue].map(([kind, ids]) => ({ kind, ids: [...ids] })),
    restart: jobs.filter((job) => job.status === "failed").map((job) => job.id),
    close: jobs.filter((job) => job.status === "dead").map((job) => job.id),
    records: [...queue.values()].reduce((total, ids) => total + ids.size, 0),
  };
}
