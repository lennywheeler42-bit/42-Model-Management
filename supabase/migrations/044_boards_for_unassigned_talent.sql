-- 044: every active talent goes on a board (owner, 2026-11-17).
--
-- The owner confirmed that every talent in the dashboard is an active client and is
-- to be shown on the website. The roster and board pages list a talent only if it is
-- on a public board, and 55 active talents were on none. This places each of them,
-- in this order of preference:
--
--   1. their CDS board (General -> Boards), mapped to the website board of that kind;
--   2. else the website board their CDS portfolios already map to (cds_portfolio_boards);
--   3. else by gender: Women or Men, and Teens / Girls or Teens / Boys for a minor.
--
-- A talent with no CDS board, no mapped portfolio and no gender is left for staff.
-- Data only, additive and idempotent: only talents with no board at all are touched,
-- so a second run, or a talent staff have since placed, changes nothing. Publishing
-- stays a separate step.

with unassigned as (
  select t.id, t.gender, t.is_minor, c.cds_boards, c.portfolios
  from public.talent t
  left join public.cds_talents c on c.talent_id = t.id
  where t.archived_at is null and t.publication_status <> 'archived'
    and not exists (select 1 from public.talent_board_assignments a where a.talent_id = t.id)
),
from_cds as (
  select u.id,
         case cb
           when 'Women Mainboard' then 'Women / Fashion'
           when 'Women Development' then 'Women / Development'
           when 'Women Commercial' then 'Women / Commercial'
           when 'Men Mainboard' then 'Men / Fashion'
           when 'Men Development' then 'Men / Development'
           when 'Men Commercial' then 'Men / Commercial'
           when 'Fitness & Athletics' then 'Fitness & Athletics'
           when 'Teens' then case lower(coalesce(u.gender, '')) when 'female' then 'Teens / Girls' when 'male' then 'Teens / Boys' else 'Teens' end
         end as board_name
  from unassigned u, unnest(coalesce(u.cds_boards, '{}')) cb
),
cds_placed as (
  select f.id, b.id as board_id from from_cds f join public.boards b on b.name = f.board_name
),
from_portfolio as (
  select u.id, m.board_id
  from unassigned u, jsonb_array_elements(coalesce(u.portfolios, '[]'::jsonb)) p
  join public.cds_portfolio_boards m on m.portfolio_name = p ->> 'name' and m.board_id is not null
  where not exists (select 1 from cds_placed f where f.id = u.id)
),
from_gender as (
  select u.id, b.id as board_id
  from unassigned u
  join public.boards b on b.name = case
    when lower(u.gender) = 'female' then case when u.is_minor then 'Teens / Girls' else 'Women' end
    when lower(u.gender) = 'male' then case when u.is_minor then 'Teens / Boys' else 'Men' end end
  where not exists (select 1 from cds_placed f where f.id = u.id)
    and not exists (select 1 from from_portfolio f where f.id = u.id)
)
insert into public.talent_board_assignments (talent_id, board_id)
select distinct id, board_id from (
  select id, board_id from cds_placed
  union all select id, board_id from from_portfolio
  union all select id, board_id from from_gender
) placed
on conflict (talent_id, board_id) do nothing;
