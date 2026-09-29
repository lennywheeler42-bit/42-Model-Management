-- Extend the existing agency tables without replacing them.
alter table public.boards add column if not exists parent_board_id uuid references public.boards(id) on delete set null;
alter table public.boards add column if not exists description text;
alter table public.boards add column if not exists internal_only boolean not null default false;
alter table public.boards add column if not exists publish_to_website boolean not null default true;
alter table public.boards add column if not exists show_in_navigation boolean not null default true;
alter table public.boards add column if not exists sort_order integer not null default 0;
update public.boards set sort_order = display_order where sort_order = 0 and display_order <> 0;

alter table public.talent add column if not exists talent_id text;
alter table public.talent add column if not exists location text;
alter table public.talent add column if not exists gender text;
alter table public.talent add column if not exists date_joined date;
alter table public.talent add column if not exists publication_status text not null default 'draft';
alter table public.talent add column if not exists show_on_website boolean not null default false;
alter table public.talent add column if not exists show_in_search boolean not null default false;
alter table public.talent add column if not exists featured boolean not null default false;
alter table public.talent alter column date_of_birth drop not null;
update public.talent set talent_id = id::text where talent_id is null;
update public.talent set show_on_website = publish_to_website where show_on_website = false and publish_to_website = true;
update public.talent set show_in_search = show_on_website where show_in_search = false and show_on_website = true;
update public.talent set publication_status = case when show_on_website then 'published' else 'draft' end where publication_status = 'draft' and show_on_website;

alter table public.talent_board_assignments add column if not exists sort_order integer not null default 0;
update public.talent_board_assignments set sort_order = board_order where sort_order = 0 and board_order <> 0;

alter table public.talent_photos add column if not exists title text;
alter table public.talent_photos add column if not exists alt_text text;
alter table public.talent_photos add column if not exists photographer text;
alter table public.talent_photos add column if not exists image_type text not null default 'portfolio';
alter table public.talent_photos add column if not exists display_order integer not null default 0;
alter table public.talent_photos add column if not exists featured boolean not null default false;
alter table public.talent_photos add column if not exists "public" boolean not null default false;
alter table public.talent_photos add column if not exists focal_point jsonb;
update public.talent_photos set "public" = publish_to_website where "public" = false and publish_to_website = true;
update public.talent_photos set featured = is_cover where featured = false and is_cover = true;
update public.talent_photos set display_order = portfolio_order where display_order = 0 and portfolio_order is not null;

alter table public.talent_measurements add column if not exists is_official boolean not null default false;
alter table public.talent_measurements add column if not exists notes text;

create index if not exists talent_public_idx on public.talent (publication_status, show_on_website, show_in_search) where archived_at is null;
create index if not exists talent_board_assignments_board_idx on public.talent_board_assignments (board_id, sort_order);
create index if not exists talent_measurements_latest_idx on public.talent_measurements (talent_id, measured_on desc);
create index if not exists talent_photos_public_idx on public.talent_photos (talent_id, "public", display_order);

alter table public.boards enable row level security;
alter table public.talent enable row level security;
alter table public.talent_board_assignments enable row level security;
alter table public.talent_measurements enable row level security;
alter table public.talent_photos enable row level security;
alter table public.talent_private_details enable row level security;

drop policy if exists "agency public boards are readable" on public.boards;
create policy "agency public boards are readable" on public.boards for select to anon, authenticated
  using (is_active and publish_to_website and not internal_only);
drop policy if exists "agency staff manage boards" on public.boards;
create policy "agency staff manage boards" on public.boards for all to authenticated
  using (public.has_any_role(array['owner','administrator','talent_manager']))
  with check (public.has_any_role(array['owner','administrator','talent_manager']));

drop policy if exists "agency staff view talent" on public.talent;
create policy "agency staff view talent" on public.talent for select to authenticated
  using (public.has_any_role(array['owner','administrator','booker','talent_manager','creative','accounting','read_only']));
drop policy if exists "agency managers manage talent" on public.talent;
create policy "agency managers manage talent" on public.talent for all to authenticated
  using (public.has_any_role(array['owner','administrator','talent_manager']))
  with check (public.has_any_role(array['owner','administrator','talent_manager']));

drop policy if exists "agency staff manage assignments" on public.talent_board_assignments;
create policy "agency staff manage assignments" on public.talent_board_assignments for all to authenticated
  using (public.has_any_role(array['owner','administrator','talent_manager','booker']))
  with check (public.has_any_role(array['owner','administrator','talent_manager','booker']));

drop policy if exists "agency staff view measurements" on public.talent_measurements;
create policy "agency staff view measurements" on public.talent_measurements for select to authenticated
  using (public.has_any_role(array['owner','administrator','talent_manager','booker','creative','read_only']));
drop policy if exists "agency managers manage measurements" on public.talent_measurements;
create policy "agency managers manage measurements" on public.talent_measurements for all to authenticated
  using (public.has_any_role(array['owner','administrator','talent_manager']))
  with check (public.has_any_role(array['owner','administrator','talent_manager']));

drop policy if exists "agency staff manage media" on public.talent_photos;
create policy "agency staff manage media" on public.talent_photos for all to authenticated
  using (public.has_any_role(array['owner','administrator','talent_manager','creative']))
  with check (public.has_any_role(array['owner','administrator','talent_manager','creative']));

drop policy if exists "agency authorized staff view private details" on public.talent_private_details;
create policy "agency authorized staff view private details" on public.talent_private_details for select to authenticated
  using (public.has_any_role(array['owner','administrator','accounting']));
