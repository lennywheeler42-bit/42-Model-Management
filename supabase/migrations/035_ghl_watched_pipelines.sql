-- Watched pipelines: the owner wants the GHL sync to follow one pipeline
-- ("Onboarded/Active Models") instead of every contact in the sub-account.
-- When at least one pipeline is watched, the sync only reads opportunities in
-- watched pipelines, only mirrors contacts that have one, and derives CRM status
-- from those opportunities alone. With none watched it behaves as before (all).
-- Additive and idempotent; staff toggle it in Dashboard -> GHL Sync -> Mapping
-- (integrations.manage, audited by the existing audit_ghl_config trigger).
alter table public.ghl_pipelines add column if not exists watched boolean not null default false;

grant select (watched) on public.ghl_pipelines to authenticated;
grant update (watched) on public.ghl_pipelines to authenticated;
