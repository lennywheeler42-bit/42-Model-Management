# Database

Migration order:

1. `001_foundation.sql` — profiles, roles, assignments, audit logs, role helpers.
2. `002_talent_core.sql` — boards, talents, private details, assignments, measurements, media, indexes, RLS.
3. `003_public_views.sql` — narrow public directory projection and grants.

All future schema changes must be added as migrations. Do not edit production tables manually.

The public view intentionally exposes only identity, discovery, approved publication flags, board context, and a primary public media path. Banking, legal, medical, contact, address, notes, and documents are separate modules and are never part of the public projection.

