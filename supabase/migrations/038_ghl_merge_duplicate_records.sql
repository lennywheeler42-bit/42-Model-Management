-- Owner, 2026-11-03: two GHL drafts are the same people as published records imported
-- from CDS (same email, phone and birth date). Each GHL contact now points at the
-- published record, so the sync updates that record and not the draft. Same steps as
-- ghl_link_talent(). The drafts are archived from the dashboard afterwards, which keeps
-- what is on them. Runs only while a contact still points at its draft, so it is
-- idempotent, and staff can link differently later.
do $$
declare
  pair record;
begin
  for pair in select * from (values
    ('MFgJUhqGEwOFhEQkApBR', '2d6907e1-7272-4acb-9425-ad707a764613'::uuid, '03590023-9bc2-4ca4-b617-63222d8d22f0'::uuid),
    ('ibKDsg1ih80SS6iMyqLX', '9e039c40-be8f-4c78-a01a-442111f33d0d'::uuid, 'b0ea7607-1115-4cad-8265-14b59ccf52fc'::uuid)
  ) as v(contact_id, draft_id, keep_id)
  loop
    update public.ghl_contacts set talent_id = pair.keep_id, auto_create_blocked = false
    where id = pair.contact_id and talent_id = pair.draft_id;
    if found then
      update public.talent t set crm_status = c.crm_status, crm_programs = c.programs
      from public.ghl_contacts c where c.id = pair.contact_id and t.id = pair.keep_id;
      update public.applications set converted_talent_id = pair.keep_id
      where source = 'ghl' and external_id = pair.contact_id and converted_talent_id = pair.draft_id;
      insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
      values (null, 'ghl.contact_moved', 'talent', pair.keep_id, jsonb_build_object('ghl_contact_id', pair.contact_id, 'from_talent', pair.draft_id));
    end if;
  end loop;
end $$;
