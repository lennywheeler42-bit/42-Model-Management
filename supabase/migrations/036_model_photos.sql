-- Phase 22: model-photos, the central private photo library. Additive and idempotent.
--
-- Files are stored by talent: <talent id>/originals|thumbnails|cropped/<file>.
--   originals   the file exactly as received (CDS import, dashboard upload); never altered
--   thumbnails  small JPEGs for galleries, so a book of 300 photos stays quick
--   cropped     the framed version staff saved; used by the website and comp cards
-- The bucket is private: staff read through short-lived signed URLs (media.view) and
-- write with media.manage. Website copies stay in talent-public, made only when staff
-- choose "Show on website", because public pages cannot use signed URLs.
-- Existing rows and files in talent-private keep working: talent_photos.storage_bucket
-- says where each original is.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('model-photos', 'model-photos', false, 52428800, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff read model photos" on storage.objects;
create policy "staff read model photos" on storage.objects for select to authenticated
  using (bucket_id = 'model-photos' and public.has_permission('media.view'));

drop policy if exists "media managers add model photos" on storage.objects;
create policy "media managers add model photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'model-photos' and public.has_permission('media.manage')
    and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$'
    and split_part(name, '/', 2) in ('originals', 'thumbnails', 'cropped'));

drop policy if exists "media managers update model photos" on storage.objects;
create policy "media managers update model photos" on storage.objects for update to authenticated
  using (bucket_id = 'model-photos' and public.has_permission('media.manage'))
  with check (bucket_id = 'model-photos' and public.has_permission('media.manage')
    and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$'
    and split_part(name, '/', 2) in ('originals', 'thumbnails', 'cropped'));

drop policy if exists "media managers delete model photos" on storage.objects;
create policy "media managers delete model photos" on storage.objects for delete to authenticated
  using (bucket_id = 'model-photos' and public.has_permission('media.manage'));

-- Erasing a talent also removes their stored files (the app deletes objects first).
drop policy if exists "owners delete model photos" on storage.objects;
create policy "owners delete model photos" on storage.objects for delete to authenticated
  using (bucket_id = 'model-photos' and public.has_permission('talent.delete'));

alter table public.talent_photos drop constraint if exists talent_photos_storage_bucket_check;
alter table public.talent_photos add constraint talent_photos_storage_bucket_check
  check (storage_bucket in ('talent-public', 'talent-private', 'model-photos'));

-- Paths inside model-photos. crop = { x, y, width, height, aspect }: fractions of the
-- upright original, so the same frame can be reopened and adjusted later. Not granted
-- to anon: the public views read public_storage_path only.
alter table public.talent_photos add column if not exists thumbnail_path text;
alter table public.talent_photos add column if not exists cropped_path text;
alter table public.talent_photos add column if not exists crop jsonb;
