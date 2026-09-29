# Security review

_Last updated: 2026-09-29 (Phase 1b, migration `009_security_hardening.sql`)._

## How roles are resolved

- **`agency_members` is the only source of authority.** Each membership is bound to an Auth user id (`agency_members.user_id`), and `has_role()`, `has_any_role()` and `is_active_agency_member()` read only `agency_members.user_id = auth.uid() AND status = 'active'`.
- **How binding happens:** database triggers derive `user_id`; callers can never set it.
  - An owner adds a member whose Auth user already exists.
  - A new Auth user signs up.
  - An existing Auth user confirms their email.
  - A new binding requires a **confirmed** email. Members who existed before 009 were bound by their current email match, so nobody lost access.
- **`profiles.role`/`status` and `profile_roles`** are read-only mirrors maintained by triggers. Users can update only their own `profiles.full_name`.
- **Last owner:** the last active owner cannot be demoted or deleted (enforced by a trigger).
- **The app checks the same thing.** `getAgencyContext()` and the proxy (`src/proxy.ts`) look up membership by `user_id`.

## Findings from discovery and their status

| ID | Finding | Status |
|---|---|---|
| S1 | Self-escalation via `profiles.role`/`email` and `profile_roles` | **Fixed** in 009. Existing self-edits are reset by the migration. |
| S2 | `talent-public` bucket listable by anyone; all uploads public | **Fixed for new media.** Anonymous listing is removed. Uploads go to the private bucket, and "Make public" copies a photo to the public bucket (the original is kept). Every bucket now has size and MIME limits. See *Open items* for legacy files. |
| S3 | `audit_log` without RLS | **Fixed.** RLS is enabled and the table is read-only (owner/administrator). New events go to `audit_logs`, written only through `write_audit()` (the actor is always the caller) and through database triggers. |
| S4 | Public views exposed exact DOB and legal names | **Fixed.** The views return `age` only when `talent.show_age` is on, plus `display_name`. There are no DOB, first/last name or private media columns. |
| S5 | Private contact fields on `talent` readable by all staff roles | **Open.** Planned for Phase 7: move them to a restricted table. |
| S6 | Banking unmasked, sensitive access unlogged | **Partly fixed.** The API masks account, routing and SWIFT numbers to the last 4 digits, and logs `sensitive.viewed` whenever legal, banking or medical data is returned. Separate medical permissions are still open. |
| S7 | Missing role check on talent creation; raw DB errors sent to clients | **Fixed.** `databaseError()` logs server-side and returns a generic message. |

## What is audited

- **Database triggers (cannot be bypassed):**
  - Talent `published`, `unpublished`, `archived` and `publication_changed`.
  - Membership insert, update and delete, recorded with before and after role and status.
- **App events via `write_audit()`:**
  - `talent.created` and `talent.edited`. Only field names are logged, never values such as DOB or phone numbers.
  - `measurements.added`, `note.added` and `<module>.saved`.
  - `media.uploaded`, `media.published` and `media.unpublished`.
  - `sensitive.viewed`.

## Automated tests

`npm run test:rls` runs every migration against an in-memory Postgres (PGlite) with stand-ins for Supabase's `auth` and `storage` schemas, API roles and default grants. It then attacks the database as each role: anon, outsider, read_only, creative, accounting, talent_manager and owner.

- **Coverage:** 40 tests covering anonymous reads and writes, public-view columns, bucket listing, the S1 exploits, module access by role, membership binding and confirmation, suspension, last-owner protection, the README owner-recovery SQL, and audit integrity.
- **`RLS_UPTO=8 npm run test:rls`** replays the suite against the pre-fix schema. 21 tests fail there, which demonstrates each vulnerability.
- **Limitation:** the stubs approximate Supabase. They don't cover Storage API behaviour beyond `storage.objects` RLS, or PostgREST specifics.

## Open items

1. **Legacy media.** Photos uploaded before 009 are still stored in the `talent-public` bucket, even if they are marked private. They can no longer be listed, but anyone holding the exact URL can open them. Move them to `talent-private` with a one-off script.
2. **Auth settings.** Keep email confirmation enabled, and turn on leaked-password protection in Supabase Auth. Membership binding trusts confirmed emails.
3. **S5 and medical permissions.** Planned for Phase 7.
4. **Rate limiting and upload abuse controls.** Needed for public forms in Phase 10.
5. **Staging.** There is no staging project yet. 009 was validated locally with the test suite and applied directly to production at the owner's request.
