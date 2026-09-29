# Database

Migration order:

1. `001_foundation.sql` — profiles, roles, assignments, audit logs, role helpers.
2. `002_talent_core.sql` — boards, talents, private details, assignments, measurements, media, indexes, RLS.
3. `003_public_views.sql` — narrow public directory projection and grants.
4. `004_public_profiles_storage.sql` — public profile projection, storage buckets, and media policies.
5. `005_agency_access_control.sql` — email allowlist, role synchronization, and dashboard access policies.
6. `006_backfill_allowlisted_profiles.sql` — backfills profiles for approved Auth users created before the access trigger.
7. `007_talent_management_expansion.sql` — General fields, structured private details, skills, contacts, addresses, notes, and measurement-history fields.
8. `008_talent_operational_modules.sql` — Legal, banking, agencies, documents, items, usage, appointments, and medical modules with role-specific RLS.
9. `009_security_hardening.sql` — Binds `agency_members` to Auth user ids and makes it the sole role authority; locks `profiles`/`profile_roles`; enables RLS on `audit_log`; adds `audit_logs.before_data/after_data`, `write_audit()`, and publication/membership audit triggers; private-by-default media (`talent_photos.storage_bucket`, `public_storage_path`); bucket size/MIME limits; public views without DOB or legal names (`talent.show_age` opt-in). See `docs/security-review.md`.

10. `010_public_views_security_invoker.sql` — **Production hotfix.** Rebuilds `public_talent_directory` and `public_talent_profiles` as `security_invoker` views, which fixes Supabase advisor lint 0010. Anonymous visitors read them through anon-only policies on published rows and public-safe column grants. Age comes from `talent_public_age()`, which never exposes the DOB. The views keep the same columns, so the deployed site keeps working.
11. `011_permissions.sql` — `permissions` and `role_permissions` tables, `has_permission()`, and `current_permissions()`. Every talent-module policy is rebuilt on permissions. Adds `agency_members.talent_id` and `current_talent_id()` for talent logins. Also rebuilds the storage policies for media and documents.
12. `012_talent_core.sql` — Visibility flags plus minor and guardian fields. Private fields are copied into `talent_private_details`; the old `talent` columns are kept but withdrawn from the API with column grants. A publication, archive and edit permission trigger. Tables for multiple phone numbers/emails and for rates.
13. `013_boards.sql` — Board hierarchy with `path_segment`, cycle and depth guards, `board_path()`, and `reorder_boards()`. Legacy boards are arranged under category parents. Audit triggers for board changes and assignments.
14. `014_profile_modules.sql` — Measurement bookkeeping and the `talent_current_measurements` view. `skill_categories` and `skills`, backfilled from free text. Contact relationship types, extra address fields, and `agencies`, backfilled.
15. `015_media.sql` — Photo metadata, `reorder_talent_photos()`, and `set_featured_photo()`. New tables `talent_videos`, `portfolios` / `portfolio_images`, and `digital_books` / `digital_book_images`, with a same-talent guard and set-contents functions.
16. `016_sensitive_modules.sql` — Identification and finance fields on `talent_legal`. Stamping and value-free audit triggers for legal, banking and medical. Private document metadata, and documents are archived rather than deleted.
17. `017_public_views.sql` — `public_boards_view`, `public_talents_view`, `public_talent_media_view`, `public_talent_portfolios_view` and `public_talent_skills_view`, all `security_invoker`. Anon-only policies and column grants, respecting `show_measurements`, `show_videos` and `show_portfolio`. The 010 views are dropped.

18. `018_function_privileges.sql` — Removes API execute rights from trigger functions; Postgres fires triggers without checking them. Removes anonymous access to the role helpers and `board_path()`, and fixes the search path of `digital_book_published_at()`. This clears advisor lints 0011, 0028 and 0029, except the deliberate ones listed in `security-review.md`.

## Naming (spec → this schema)

These existing tables are kept rather than duplicated:

| Spec name | This schema |
|---|---|
| `talents` | `talent` |
| `talent_boards` | `talent_board_assignments` |
| `talent_images` | `talent_photos` |
| `talent_financial` | `talent_banking` |
| `documents` | `talent_documents` |
| `talent_measurement_history` | `talent_measurements` (append-only) |

## Column grants

- **`talent`** is readable and writable only through explicitly granted columns (012 for signed-in users, 017 for anon). A new column must be added to those grants deliberately.
- **Contract step:** the private columns still present on `talent` (`date_of_birth`, `mobile`, `email` and others) are unreachable through the API. Drop them in a later migration once staging has confirmed the copy into `talent_private_details`.

## Tests

RLS regression tests: `npm run test:rls` (see `tests/rls/`).

All future schema changes must be added as migrations. Do not edit production tables manually.

The public views intentionally expose only identity, discovery, approved publication flags, board context, approved measurements, and public media paths. Banking, legal, medical, contact, address, notes, and documents are separate modules and are never part of the public projection.

The dashboard talent editor follows the 16 recommended record tabs: General, Other, Legal, Addresses, Contacts, Banking, Agencies, Stats, Skills, Documents, Items, Usage, Appointments, Medical, Notes, and Media. Modules with no records show an empty state rather than fabricated data.
