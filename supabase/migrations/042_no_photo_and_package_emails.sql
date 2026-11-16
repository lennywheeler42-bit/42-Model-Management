-- 042: talents without a photo stay off the website; packages can be emailed.
--
-- 1. Website (owner, 2026-11-17): a talent with no photo on the website is not shown
--    at all. public_talents_view now requires a website photo, so the roster, search,
--    the profile page and the sitemap all leave such a talent out until staff add one.
-- 2. Packages (owner, 2026-11-17): a talent in a package who has no photo to show is
--    listed by name with the approved stats only. Location, gender and the profile
--    link are left out for them.
-- 3. Packages can be emailed to client contacts. Every recipient gets a link of their
--    own (package_emails), stored as a SHA-256 hash like the package's own link, with
--    its own expiry, view count and revocation. The message text comes from an
--    editable template (email_templates).
--
-- Additive and idempotent. No existing row is changed.

-- ---------------------------------------------------------------------------
-- 1. The website shows only talent with a photo
-- ---------------------------------------------------------------------------
create or replace view public.public_talents_view with (security_invoker = true) as
select
  t.id,
  t.slug,
  t.display_name,
  t.location,
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

-- The same rule for every anonymous read, not only the view: without a website photo
-- a published talent's row (name, location, gender) cannot be read at all, and so
-- neither can its stats, portfolios or skills, which all depend on talent_is_public().
-- Security definer so the check does not go back through the photo policy, which
-- itself asks whether the talent is public. It answers yes or no for an id, no more.
create or replace function public.talent_has_website_photo(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.talent_photos p
    where p.talent_id = target and p."public" and p.public_storage_path is not null and p.archived_at is null
  );
$$;
revoke execute on function public.talent_has_website_photo(uuid) from public;
grant execute on function public.talent_has_website_photo(uuid) to anon, authenticated;

drop policy if exists "public reads published talent" on public.talent;
create policy "public reads published talent" on public.talent for select to anon
  using (publication_status = 'published' and show_on_website and archived_at is null and public.talent_has_website_photo(id));

-- ---------------------------------------------------------------------------
-- 2. Emailed packages
-- ---------------------------------------------------------------------------
create table if not exists public.email_templates (
  key text primary key check (key ~ '^[a-z_]{1,40}$'),
  subject text not null check (length(subject) between 1 and 200),
  body text not null check (length(body) between 1 and 6000),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create table if not exists public.package_emails (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  contact_id uuid references public.company_contacts(id) on delete set null,
  to_email text not null check (length(to_email) between 3 and 200 and position('@' in to_email) > 1),
  to_name text check (length(to_name) <= 160),
  subject text not null check (length(subject) between 1 and 300),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- queued: saved, not sent yet; sent: handed to the mail server; manual: opened in
  -- the staff member's own email app; failed: the mail server refused it.
  status text not null default 'queued' check (status in ('queued', 'sent', 'manual', 'failed')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  sent_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists package_emails_package_idx on public.package_emails (package_id, created_at desc);
create index if not exists package_emails_contact_idx on public.package_emails (contact_id);

-- Audit: who was emailed is recorded by contact, never by address.
create or replace function public.audit_package_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'package.emailed', 'package', new.package_id, jsonb_build_object('email_id', new.id, 'contact_id', new.contact_id, 'expires_at', new.expires_at));
  elsif new.revoked_at is not null and old.revoked_at is null then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'package.email_revoked', 'package', new.package_id, jsonb_build_object('email_id', new.id));
  end if;
  return new;
end;
$$;
drop trigger if exists audit_package_email on public.package_emails;
create trigger audit_package_email after insert or update on public.package_emails for each row execute function public.audit_package_email();

create or replace function public.touch_email_template()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists touch_email_template on public.email_templates;
create trigger touch_email_template before insert or update on public.email_templates for each row execute function public.touch_email_template();
revoke execute on function public.audit_package_email(), public.touch_email_template() from public, anon, authenticated;

alter table public.email_templates enable row level security;
alter table public.package_emails enable row level security;
revoke all on public.email_templates, public.package_emails from anon;

drop policy if exists "package managers manage email templates" on public.email_templates;
create policy "package managers manage email templates" on public.email_templates for all to authenticated
  using (public.has_permission('packages.manage')) with check (public.has_permission('packages.manage'));
drop policy if exists "package managers manage package emails" on public.package_emails;
create policy "package managers manage package emails" on public.package_emails for all to authenticated
  using (public.has_permission('packages.manage')) with check (public.has_permission('packages.manage'));

-- ---------------------------------------------------------------------------
-- 3. The share page: emailed links, and no private details without a photo
-- ---------------------------------------------------------------------------
create or replace function public.get_shared_package(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pkg public.packages%rowtype;
  mail public.package_emails%rowtype;
  expiry timestamptz;
  talent_json jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  -- The package's own link first, then a link emailed to one recipient.
  select * into pkg from public.packages
  where share_token_hash = p_token_hash and revoked_at is null and (expires_at is null or expires_at > now());
  if found then
    expiry := pkg.expires_at;
  else
    select * into mail from public.package_emails
    where token_hash = p_token_hash and revoked_at is null and expires_at > now();
    if not found then
      return null;
    end if;
    select * into pkg from public.packages where id = mail.package_id;
    if not found then
      return null;
    end if;
    expiry := mail.expires_at;
    update public.package_emails set view_count = view_count + 1, last_viewed_at = now() where id = mail.id;
  end if;

  update public.packages set view_count = view_count + 1, last_viewed_at = now() where id = pkg.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'name', t.display_name,
    -- Without a photo to show, only the name and the approved stats go out.
    'location', case when ph.photos is not null then t.location end,
    'gender', case when ph.photos is not null then t.gender end,
    'note', pi.note,
    'profile_slug', case when ph.photos is not null and t.publication_status = 'published' and t.show_on_website and t.archived_at is null then t.slug end,
    'measurements', case when pkg.show_measurements and t.show_measurements then (
      select jsonb_strip_nulls(jsonb_build_object('height_cm', m.height_cm, 'bust_cm', m.bust_chest_cm, 'waist_cm', m.waist_cm, 'hips_cm', m.hips_cm,
        'shoe_size', m.shoe_size_us, 'suit_size', m.suit_size, 'hair_color', m.hair_color, 'eye_color', m.eye_color))
      from public.talent_measurements m where m.talent_id = t.id
      order by m.is_official desc, m.measured_on desc, m.created_at desc limit 1) end,
    'photos', coalesce(ph.photos, '[]'::jsonb)
  ) order by pi.sort_order, t.display_name), '[]'::jsonb)
  into talent_json
  from public.package_items pi
  join public.talent t on t.id = pi.talent_id
  left join lateral (
    select jsonb_agg(jsonb_build_object('path', p.public_storage_path, 'alt', p.alt_text) order by p.featured desc, p.display_order, p.created_at) as photos
    from (select * from public.talent_photos p
          where p.talent_id = t.id and p."public" and p.public_storage_path is not null and p.archived_at is null
          order by p.featured desc, p.display_order, p.created_at limit 8) p
  ) ph on true
  where pi.package_id = pkg.id and t.archived_at is null;

  return jsonb_build_object('title', pkg.title, 'message', pkg.message, 'expires_at', expiry, 'talent', talent_json);
end;
$$;
revoke execute on function public.get_shared_package(text) from public;
grant execute on function public.get_shared_package(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Photo counts for the roster's website status
-- ---------------------------------------------------------------------------
-- How many photos each talent has, how many are approved, and how many are on the
-- website: the roster marks talent with none "No photo". Runs as the caller, so RLS
-- on talent_photos decides what is counted.
create or replace function public.talent_photo_counts(targets uuid[])
returns table (talent_id uuid, photos integer, approved integer, website integer)
language sql stable security invoker set search_path = public as $$
  select p.talent_id,
         count(*)::int,
         (count(*) filter (where p.review_status = 'approved'))::int,
         (count(*) filter (where p."public" and p.public_storage_path is not null))::int
  from public.talent_photos p
  where p.talent_id = any(targets) and p.archived_at is null
  group by p.talent_id;
$$;
revoke execute on function public.talent_photo_counts(uuid[]) from public, anon;
grant execute on function public.talent_photo_counts(uuid[]) to authenticated;
