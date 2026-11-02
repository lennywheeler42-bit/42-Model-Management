-- Owner, 2026-11-03: only active models are migrated, not WebForFashion's whole Archives
-- list. Former talents staged before that decision are skipped, and their staged contact
-- details and stats are cleared, as the dashboard has no use for them and CDS keeps its
-- own. The three kept records belong to active models on the GHL pipeline. Idempotent.
update public.cds_talents set
  excluded = true,
  match_status = 'skipped',
  match_reason = 'Former talent, not an active model',
  email = null,
  phone = null,
  profile = jsonb_build_object('archived_in_cds', true),
  portfolios = '[]'::jsonb,
  cds_boards = '{}',
  updated_at = now()
where profile ->> 'archived_in_cds' = 'true'
  and coalesce(wff_id, '') not in ('116025', '131765', '186712');
