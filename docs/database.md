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

RLS regression tests: `npm run test:rls` (see `tests/rls/`).

All future schema changes must be added as migrations. Do not edit production tables manually.

The public views intentionally expose only identity, discovery, approved publication flags, board context, approved measurements, and public media paths. Banking, legal, medical, contact, address, notes, and documents are separate modules and are never part of the public projection.

The dashboard talent editor follows the 16 recommended record tabs: General, Other, Legal, Addresses, Contacts, Banking, Agencies, Stats, Skills, Documents, Items, Usage, Appointments, Medical, Notes, and Media. Modules with no records show an empty state rather than fabricated data.
