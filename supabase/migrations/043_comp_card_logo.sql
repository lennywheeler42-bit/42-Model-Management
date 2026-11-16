-- 043: the comp card logo can be replaced (owner, 2026-11-17).
--
-- Comp cards print the 42 logo. Staff with settings.manage can now upload another
-- logo and change the line under it, in the comp card editor; every comp card uses
-- it from then on. "Use the 42 logo" goes back to the built-in one.
--
-- * brand-assets: a public bucket (a logo is not private), written only by
--   settings.manage, at comp-card/logo-<time>.png. The server turns every upload
--   into a PNG first, so only real images are stored.
-- * comp_card_settings: one row holding the logo's path and the line under it.
--
-- Additive and idempotent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', true, 5242880, array['image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff read brand assets" on storage.objects;
create policy "staff read brand assets" on storage.objects for select to authenticated
  using (bucket_id = 'brand-assets' and public.has_permission('media.view'));
drop policy if exists "settings managers upload brand assets" on storage.objects;
create policy "settings managers upload brand assets" on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-assets' and public.has_permission('settings.manage'));
drop policy if exists "settings managers update brand assets" on storage.objects;
create policy "settings managers update brand assets" on storage.objects for update to authenticated
  using (bucket_id = 'brand-assets' and public.has_permission('settings.manage'));
drop policy if exists "settings managers delete brand assets" on storage.objects;
create policy "settings managers delete brand assets" on storage.objects for delete to authenticated
  using (bucket_id = 'brand-assets' and public.has_permission('settings.manage'));

create table if not exists public.comp_card_settings (
  -- One row only.
  id boolean primary key default true check (id),
  -- Path in brand-assets; null prints the built-in 42 logo.
  logo_path text check (logo_path is null or logo_path ~ '^comp-card/logo-[0-9]{10,16}\.png$'),
  -- The line under the logo; null prints "Model Management", '' prints nothing.
  tagline text check (tagline is null or length(tagline) <= 60),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_comp_card_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists touch_comp_card_settings on public.comp_card_settings;
create trigger touch_comp_card_settings before insert or update on public.comp_card_settings for each row execute function public.touch_comp_card_settings();
revoke execute on function public.touch_comp_card_settings() from public, anon, authenticated;

alter table public.comp_card_settings enable row level security;
revoke all on public.comp_card_settings from anon;

drop policy if exists "staff read comp card settings" on public.comp_card_settings;
create policy "staff read comp card settings" on public.comp_card_settings for select to authenticated
  using (public.has_permission('media.view'));
drop policy if exists "settings managers insert comp card settings" on public.comp_card_settings;
create policy "settings managers insert comp card settings" on public.comp_card_settings for insert to authenticated
  with check (public.has_permission('settings.manage'));
drop policy if exists "settings managers update comp card settings" on public.comp_card_settings;
create policy "settings managers update comp card settings" on public.comp_card_settings for update to authenticated
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
