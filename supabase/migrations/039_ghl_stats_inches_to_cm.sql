-- Owner, 2026-11-03: two draft talents have bust, waist or hips in inches in their
-- current stats. The numbers came from CDS and looked like a match for GHL's inch
-- values, so the first sync carried them into its snapshot in the cm columns. Only
-- values up to 60 change, the same rule the GHL parser uses for inches, so this is
-- idempotent. Older CDS snapshots stay as history.
update public.talent_measurements set
  bust_chest_cm = case when bust_chest_cm <= 60 then round((bust_chest_cm * 2.54)::numeric, 1) else bust_chest_cm end,
  waist_cm = case when waist_cm <= 60 then round((waist_cm * 2.54)::numeric, 1) else waist_cm end,
  hips_cm = case when hips_cm <= 60 then round((hips_cm * 2.54)::numeric, 1) else hips_cm end
where source = 'ghl'
  and talent_id in ('e1adc5a5-7e07-4086-80fd-732b1b8c7320', '81831333-4d72-4d0e-bdc3-fa61bbbcaae3')
  and (bust_chest_cm <= 60 or waist_cm <= 60 or hips_cm <= 60);
