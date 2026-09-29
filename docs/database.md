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

All future schema changes must be added as migrations. Do not edit production tables manually.

The public views intentionally expose only identity, discovery, approved publication flags, board context, approved measurements, and public media paths. Banking, legal, medical, contact, address, notes, and documents are separate modules and are never part of the public projection.

The dashboard talent editor follows the 16 recommended record tabs: General, Other, Legal, Addresses, Contacts, Banking, Agencies, Stats, Skills, Documents, Items, Usage, Appointments, Medical, Notes, and Media. Modules with no records show an empty state rather than fabricated data.
