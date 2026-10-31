-- The GHL sync follows one pipeline only (owner, 2026-10-31 and 2026-11-03): the
-- "Onboarded/Active Models" pipeline. It was created in GHL after the sync stopped
-- on 2026-10-08, so discovery has never seen it. Recording it here puts the watch
-- and the stage mapping in place before the first run with a new token. Discovery
-- refreshes the name and stages but never touches watched, purpose or the mapping.
-- Additive and idempotent. Staff can change all of this under GHL Sync -> Mapping.
insert into public.ghl_pipelines (id, name, purpose, watched)
values ('yrD3eOpwL09Cvpaul4d5', 'Onboarded/Active Models', 'talent', true)
on conflict (id) do update set watched = true, purpose = 'talent', updated_at = now();

update public.ghl_pipelines set watched = false, updated_at = now()
where watched and id <> 'yrD3eOpwL09Cvpaul4d5';

insert into public.ghl_pipeline_stages (id, pipeline_id, name, position, normalized_status, mapping_source)
values ('8814e6fa-dde1-4135-9cbb-02c1d9314978', 'yrD3eOpwL09Cvpaul4d5', 'Active Models', 0, 'active', 'staff')
on conflict (id) do update set normalized_status = 'active', mapping_source = 'staff', updated_at = now();
