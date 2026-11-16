-- 046: default text on every comp card (owner, 2026-11-17).
--
-- The line under the name and the contact lines on the back are now one setting for
-- every card, kept with the logo in comp_card_settings (043) and edited in the comp
-- card editor by staff with settings.manage. A card can still type over them for one
-- talent. The line under the name no longer defaults to the talent's location.
--
-- Starting values, as the owner gave them:
--   line under the name: 42modelmanagement.com
--   contact lines:       lenny@42modelmanagement.com / 214-463-9970
--
-- Additive and idempotent: values staff have already saved are kept.

alter table public.comp_card_settings add column if not exists subtitle text;
alter table public.comp_card_settings add column if not exists contact_lines text[];

alter table public.comp_card_settings drop constraint if exists comp_card_settings_subtitle_check;
alter table public.comp_card_settings add constraint comp_card_settings_subtitle_check
  check (subtitle is null or length(subtitle) <= 80);
alter table public.comp_card_settings drop constraint if exists comp_card_settings_contact_lines_check;
alter table public.comp_card_settings add constraint comp_card_settings_contact_lines_check
  -- Up to 5 lines; the app keeps each to 60 characters, the database bounds the total.
  check (contact_lines is null or (coalesce(array_length(contact_lines, 1), 0) <= 5
    and length(array_to_string(contact_lines, '|')) <= 310));

insert into public.comp_card_settings (id, subtitle, contact_lines)
values (true, '42modelmanagement.com', array['lenny@42modelmanagement.com', '214-463-9970'])
on conflict (id) do update
  set subtitle = coalesce(public.comp_card_settings.subtitle, excluded.subtitle),
      contact_lines = coalesce(public.comp_card_settings.contact_lines, excluded.contact_lines);
