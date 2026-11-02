-- Owner, 2026-11-03: stats come from GHL first; what GHL lacks comes from CDS, and what
-- CDS lacks comes from GHL. Talents already in the dashboard when CDS was imported never
-- received its stats, and the sync only reads pipeline contacts, so this fills today's
-- blanks once. Every talent that gains a value gets a new official snapshot carrying
-- all its current values, so nothing is overwritten and each fill can be removed by
-- deleting its row. A letter in the shoe size counts as blank. Stored GHL copies are
-- used only for a talent with no contact of its own, when exactly one unclaimed contact
-- shares its email or phone and first name, or is the contact of its archived duplicate.
-- Values outside a believable range are skipped. Running it again adds nothing.
create function pg_temp.stat_text(raw text) returns text language sql immutable as $fn$
  select case when lower(trim(coalesce(raw, ''))) in ('', '.', '-', '...', 'n/a', 'na', 'none', 'unknown', 'unsure') then null else trim(raw) end
$fn$;
create function pg_temp.stat_number(raw text) returns numeric language sql immutable as $fn$
  select substring(replace(coalesce(raw, ''), ',', '.') from '\d+(?:\.\d+)?')::numeric
$fn$;
create function pg_temp.between_or_null(value numeric, low numeric, high numeric) returns numeric language sql immutable as $fn$
  select case when value between low and high then value end
$fn$;
-- Same rule as parseLength(): a bare number up to 60 is inches, unless marked cm.
create function pg_temp.ghl_length(raw text) returns numeric language sql immutable as $fn$
  select case when lower(raw) ~ '\d\s*cm' then pg_temp.stat_number(raw)
              when pg_temp.stat_number(raw) <= 60 or lower(raw) ~ '\d\s*(in|inches|")' then round(pg_temp.stat_number(raw) * 2.54, 1)
              else pg_temp.stat_number(raw) end
$fn$;
create function pg_temp.ghl_field(fields jsonb, wanted text, as_length boolean) returns text language sql stable as $fn$
  select value from (
    select case when as_length then pg_temp.between_or_null(pg_temp.ghl_length(pg_temp.stat_text(fields ->> d.id)), 30, 200)::text else pg_temp.stat_text(fields ->> d.id) end as value, d.name
    from public.ghl_field_definitions d where d.target = wanted and d.removed_at is null
  ) found where value is not null order by name limit 1
$fn$;

with people as (
  select t.id as talent_id, m.*, c.stats, g.fields
  from public.talent t
  left join public.talent_private_details pd on pd.talent_id = t.id
  left join lateral (select x.profile -> 'stats' as stats from public.cds_talents x where x.talent_id = t.id and not x.excluded order by x.cds_id limit 1) c on true
  left join lateral (
    select to_jsonb(z) as m_row from public.talent_measurements z where z.talent_id = t.id
    order by z.is_official desc, z.measured_on desc, z.created_at desc limit 1
  ) m on true
  left join lateral (
    select case when count(*) = 1 then (array_agg(k.custom_fields))[1] end as fields
    from public.ghl_contacts k left join public.talent owner on owner.id = k.talent_id
    where k.removed_at is null
      and not exists (select 1 from public.ghl_contacts mine where mine.talent_id = t.id)
      and ((nullif(trim(pd.email), '') is not null and lower(k.email) = lower(trim(pd.email)))
        or (length(right(regexp_replace(coalesce(pd.mobile, pd.phone, ''), '[^0-9]', '', 'g'), 10)) = 10
            and right(regexp_replace(coalesce(k.phone, ''), '[^0-9]', '', 'g'), 10) = right(regexp_replace(coalesce(pd.mobile, pd.phone, ''), '[^0-9]', '', 'g'), 10)))
      and ((k.talent_id is null and lower(trim(k.first_name)) = lower(trim(t.first_name)))
        or (owner.archived_at is not null and k.date_of_birth = pd.date_of_birth))
  ) g on true
  where t.archived_at is null and (c.stats is not null or g.fields is not null)
),
cds as (
  select p.*,
    pg_temp.between_or_null(pg_temp.stat_number(coalesce(pg_temp.stat_text(stats ->> 'height_cm'), pg_temp.stat_text(stats ->> 'real_height_cm'))), 100, 230) as c_height,
    pg_temp.between_or_null(pg_temp.stat_number(coalesce(pg_temp.stat_text(stats ->> 'bust_cm'), pg_temp.stat_text(stats ->> 'chest_cm'), pg_temp.stat_text(stats ->> 'real_bust_cm'), pg_temp.stat_text(stats ->> 'real_chest_cm'))), 60, 160) as c_bust,
    pg_temp.between_or_null(pg_temp.stat_number(coalesce(pg_temp.stat_text(stats ->> 'waist_cm'), pg_temp.stat_text(stats ->> 'real_waist_cm'))), 40, 130) as c_waist,
    pg_temp.between_or_null(pg_temp.stat_number(coalesce(pg_temp.stat_text(stats ->> 'hips_cm'), pg_temp.stat_text(stats ->> 'real_hips_cm'))), 60, 160) as c_hips,
    coalesce(pg_temp.stat_text(stats ->> 'shoe_us'), pg_temp.stat_text(stats ->> 'real_shoe_us')) as c_shoe,
    coalesce(pg_temp.stat_text(stats ->> 'hair_color'), pg_temp.stat_text(stats ->> 'real_hair_color')) as c_hair,
    coalesce(pg_temp.stat_text(stats ->> 'eyes_color'), pg_temp.stat_text(stats ->> 'real_eyes_color')) as c_eyes,
    coalesce(pg_temp.stat_text(stats ->> 'hair_length'), pg_temp.stat_text(stats ->> 'real_hair_length')) as c_hair_length,
    coalesce(pg_temp.stat_text(stats ->> 'hair_type'), pg_temp.stat_text(stats ->> 'real_hair_type')) as c_hair_type,
    coalesce(pg_temp.stat_text(stats ->> 'body_type'), pg_temp.stat_text(stats ->> 'real_body_type')) as c_body,
    coalesce(pg_temp.stat_text(stats ->> 'dress_size_us'), pg_temp.stat_text(stats ->> 'real_dress_size_us')) as c_dress,
    pg_temp.ghl_field(fields, 'bust_cm', true)::numeric as g_bust,
    pg_temp.ghl_field(fields, 'waist_cm', true)::numeric as g_waist,
    pg_temp.ghl_field(fields, 'hips_cm', true)::numeric as g_hips,
    pg_temp.ghl_field(fields, 'hair_color', false) as g_hair,
    pg_temp.ghl_field(fields, 'eye_color', false) as g_eyes,
    pg_temp.ghl_field(fields, 'shoe_size', false) as g_shoe
  from people p
),
filled as (
  select c.talent_id, c.m_row, c.c_height, c.c_bust, c.c_waist, c.c_hips,
    (m_row ->> 'height_cm')::numeric as old_height,
    (m_row ->> 'bust_chest_cm')::numeric as old_bust,
    (m_row ->> 'waist_cm')::numeric as old_waist,
    (m_row ->> 'hips_cm')::numeric as old_hips,
    m_row ->> 'shoe_size_us' as old_shoe,
    coalesce((m_row ->> 'height_cm')::numeric, c_height) as height_cm,
    coalesce((m_row ->> 'bust_chest_cm')::numeric, c_bust, g_bust) as bust_chest_cm,
    coalesce((m_row ->> 'waist_cm')::numeric, c_waist, g_waist) as waist_cm,
    coalesce((m_row ->> 'hips_cm')::numeric, c_hips, g_hips) as hips_cm,
    coalesce(case when m_row ->> 'shoe_size_us' ~ '\d' then m_row ->> 'shoe_size_us' end,
             case when c_shoe ~ '\d' then c_shoe end, case when g_shoe ~ '\d' then g_shoe end, m_row ->> 'shoe_size_us') as shoe_size_us,
    coalesce(m_row ->> 'hair_color', c_hair, g_hair) as hair_color,
    coalesce(m_row ->> 'eye_color', c_eyes, g_eyes) as eye_color,
    coalesce(m_row ->> 'hair_length', c_hair_length) as hair_length,
    coalesce(m_row ->> 'hair_type', c_hair_type) as hair_type,
    coalesce(m_row ->> 'body_type', c_body) as body_type,
    coalesce(m_row ->> 'dress_size', c_dress) as dress_size,
    -- The source is GHL only when CDS supplied none of what was filled.
    not ((m_row ->> 'height_cm' is null and c_height is not null)
      or (m_row ->> 'bust_chest_cm' is null and c_bust is not null)
      or (m_row ->> 'waist_cm' is null and c_waist is not null)
      or (m_row ->> 'hips_cm' is null and c_hips is not null)
      or (coalesce(m_row ->> 'shoe_size_us', '') !~ '\d' and coalesce(c_shoe, '') ~ '\d')
      or (m_row ->> 'hair_color' is null and c_hair is not null)
      or (m_row ->> 'eye_color' is null and c_eyes is not null)
      or (m_row ->> 'hair_length' is null and c_hair_length is not null)
      or (m_row ->> 'hair_type' is null and c_hair_type is not null)
      or (m_row ->> 'body_type' is null and c_body is not null)
      or (m_row ->> 'dress_size' is null and c_dress is not null)) as ghl_only_fill
  from cds c
)
insert into public.talent_measurements (
  talent_id, measured_on, is_official, source, notes,
  height_cm, bust_chest_cm, waist_cm, hips_cm, shoe_size_us, hair_color, eye_color, hair_length, hair_type, body_type, dress_size,
  weight_kg, shirt_size, pants_size, ethnicity, head_cm, collar_cm, suit_size, suit_length, shoe_size_custom, gloves, inseam_cm, outseam_cm, sleeve_cm)
select f.talent_id, current_date, true, case when f.ghl_only_fill then 'ghl' else 'cds' end,
  case when f.ghl_only_fill then 'Blank stats filled from GHL (owner, 2026-11-03)' else 'Blank stats filled from CDS (owner, 2026-11-03)' end,
  f.height_cm, f.bust_chest_cm, f.waist_cm, f.hips_cm, f.shoe_size_us, f.hair_color, f.eye_color, f.hair_length, f.hair_type, f.body_type, f.dress_size,
  (m_row ->> 'weight_kg')::numeric, m_row ->> 'shirt_size', m_row ->> 'pants_size', m_row ->> 'ethnicity', (m_row ->> 'head_cm')::numeric, (m_row ->> 'collar_cm')::numeric,
  m_row ->> 'suit_size', m_row ->> 'suit_length', m_row ->> 'shoe_size_custom', m_row ->> 'gloves', (m_row ->> 'inseam_cm')::numeric, (m_row ->> 'outseam_cm')::numeric, (m_row ->> 'sleeve_cm')::numeric
from filled f
where f.height_cm is distinct from f.old_height
   or f.bust_chest_cm is distinct from f.old_bust
   or f.waist_cm is distinct from f.old_waist
   or f.hips_cm is distinct from f.old_hips
   or f.shoe_size_us is distinct from f.old_shoe
   or f.hair_color is distinct from (m_row ->> 'hair_color')
   or f.eye_color is distinct from (m_row ->> 'eye_color')
   or f.hair_length is distinct from (m_row ->> 'hair_length')
   or f.hair_type is distinct from (m_row ->> 'hair_type')
   or f.body_type is distinct from (m_row ->> 'body_type')
   or f.dress_size is distinct from (m_row ->> 'dress_size');

drop function pg_temp.ghl_field(jsonb, text, boolean);
drop function pg_temp.ghl_length(text);
drop function pg_temp.between_or_null(numeric, numeric, numeric);
drop function pg_temp.stat_number(text);
drop function pg_temp.stat_text(text);
