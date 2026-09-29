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

## Supabase advisor: Security Definer View (2026-09-30)

- **Finding:** the advisor flagged `public_talent_directory` and `public_talent_profiles` (lint 0010, critical). Migration 009 created them as ordinary views, which run with the owner's rights and bypass RLS.
- **Fix (migration 010):** both views are now `security_invoker`. Anonymous visitors read published rows through anon-only policies:
  - `talent`
  - `talent_photos`
  - `talent_measurements`
  - `talent_board_assignments`
  - `boards` (policy already existed)
- **Column grants:** anon gets column grants only for public-safe fields. DOB, contact details, rates and notes are never granted, and `talent_public_age()` returns an age only when `show_age` is on.
- **Later views:** migration 017 builds the new public views the same way. `tests/rls/public-views.test.mjs` asserts that no public view lacks `security_invoker`, both at the production-equivalent state (through 010) and with every migration.
- **Advisor warnings after migration 018.**
  - **Removed:** trigger functions no longer have API execute rights. The role helpers and `board_path()` are no longer callable by anonymous visitors.
  - **Deliberate, remaining:**
    - `talent_public_age()` is callable by anon, because the public views call it.
    - `has_permission()`, `current_permissions()`, `current_agency_role()`, `current_talent_id()`, `write_audit()`, `has_role()`, `has_any_role()`, `is_active_agency_member()` and `board_path()` are callable by signed-in users, because RLS policies and the app use them.
    - Each has a fixed `search_path` and returns only booleans, permission keys, a path, or an opt-in age.
  - **Unknown origin:** `rls_auto_enable()` predates the tracked migrations. Review it in the Supabase dashboard.
  - **Dashboard setting to enable:** Auth leaked-password protection (Authentication → Settings).

## Findings from discovery and their status

| ID | Finding | Status |
|---|---|---|
| S1 | Self-escalation via `profiles.role`/`email` and `profile_roles` | **Fixed** in 009. Existing self-edits are reset by the migration. |
| S2 | `talent-public` bucket listable by anyone; all uploads public | **Fixed for new media.** Anonymous listing is removed. Uploads go to the private bucket, and "Make public" copies a photo to the public bucket (the original is kept). Every bucket now has size and MIME limits. See *Open items* for legacy files. |
| S3 | `audit_log` without RLS | **Fixed.** RLS is enabled and the table is read-only (owner/administrator). New events go to `audit_logs`, written only through `write_audit()` (the actor is always the caller) and through database triggers. |
| S4 | Public views exposed exact DOB and legal names | **Fixed.** The views return `age` only when `talent.show_age` is on, plus `display_name`. There are no DOB, first/last name or private media columns. |
| S5 | Private contact fields on `talent` readable by all staff roles | **Fixed** in 012. Values were copied to `talent_private_details` (`talent.private.view`), and the old `talent` columns were withdrawn from the API with column grants. Dropping them is a pending contract step. |
| S6 | Banking unmasked, sensitive access unlogged | **Partly fixed.** The API masks account, routing and SWIFT numbers to the last 4 digits, and logs `sensitive.viewed` whenever legal, banking or medical data is returned. Medical now has its own `medical.view`/`medical.edit` permissions (011), and legal/banking/medical changes are audited without values (016). |
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
3. **Contract step.** Drop the withdrawn private columns on `talent` once the copy into `talent_private_details` is confirmed (see `database.md`).
4. **Rate limiting and upload abuse controls.** Needed for public forms in Phase 10.
5. **Staging.** There is no staging project yet. 009 was validated locally with the test suite and applied directly to production at the owner's request.
