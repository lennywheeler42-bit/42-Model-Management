-- 045: no talent's location on the website (owner, 2026-11-17).
--
-- The website no longer shows where a talent is based: not on the roster cards, the
-- board pages or the profile, and it can no longer be searched by. The public view
-- returns an empty location, and anonymous visitors lose the right to read the
-- column from the table at all, so no other public route can show it either.
-- Staff still see and edit the location in the dashboard; packages and comp cards,
-- which staff send to a client themselves, are unchanged.
--
-- Additive and idempotent. No data is changed.

create or replace view public.public_talents_view with (security_invoker = true) as
select
  t.id,
  t.slug,
  t.display_name,
  -- Location is not shown on the website (045). The column stays, always empty, so
  -- the view keeps its shape.
  null::text as location,
  t.gender,
  public.talent_public_age(t.id) as age,
  t.featured,
  t.show_in_search,
  t.public_bio,
  t.show_measurements,
  t.show_portfolio,
  t.show_videos,
  img.public_storage_path as primary_image_path,
  img.alt_text as primary_image_alt,
  case when t.show_measurements then m.height_cm end as height_cm,
  case when t.show_measurements then m.bust_chest_cm end as bust_cm,
  case when t.show_measurements then m.waist_cm end as waist_cm,
  case when t.show_measurements then m.hips_cm end as hips_cm,
  case when t.show_measurements then m.shoe_size_us::text end as shoe_size,
  case when t.show_measurements then m.suit_size end as suit_size,
  case when t.show_measurements then m.inseam_cm end as inseam_cm,
  case when t.show_measurements then m.eye_color end as eye_color,
  case when t.show_measurements then m.hair_color end as hair_color,
  coalesce(bb.boards, '[]'::jsonb) as boards,
  coalesce(bb.paths, '{}'::text[]) as board_paths,
  t.updated_at
from public.talent t
left join lateral (
  select p.public_storage_path, p.alt_text from public.talent_photos p
  where p.talent_id = t.id and p."public" and p.public_storage_path is not null and p.archived_at is null
  order by p.featured desc, p.display_order asc, p.created_at asc
  limit 1
) img on true
left join lateral (
  select tm.height_cm, tm.bust_chest_cm, tm.waist_cm, tm.hips_cm, tm.shoe_size_us, tm.suit_size, tm.inseam_cm, tm.eye_color, tm.hair_color
  from public.talent_measurements tm
  where tm.talent_id = t.id
  order by tm.is_official desc, tm.measured_on desc, tm.created_at desc
  limit 1
) m on true
left join lateral (
  select jsonb_agg(jsonb_build_object('id', pb.id, 'name', pb.name, 'slug', pb.slug, 'path', pb.path, 'sort_order', tba.sort_order)
                   order by pb.depth, pb.sort_order, pb.name) as boards,
         array_agg(pb.path order by pb.path) as paths
  from public.talent_board_assignments tba
  join public.public_boards_view pb on pb.id = tba.board_id
  where tba.talent_id = t.id
) bb on true
where t.publication_status = 'published'
  and t.show_on_website
  and t.archived_at is null
  -- No photo on the website, no place on the website.
  and img.public_storage_path is not null;

revoke all on public.public_talents_view from anon, authenticated;
grant select on public.public_talents_view to anon, authenticated;

revoke select (location) on public.talent from anon;
