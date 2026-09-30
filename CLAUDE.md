# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

This repo is a talent-agency system for 42 Model Management. It has two halves:

- a public website (`/`, `/models/...`)
- a staff dashboard (`/dashboard`)

Both run on Next.js 16 (App Router), React 19, Tailwind v4 and Supabase (Postgres + RLS, Auth, Storage).

Before starting work, read `docs/HANDOFF.md` (current state) and `docs/ROADMAP.md` (remaining phases 9–17). The product spec lives outside the repo: `../42_Agency_OS_Claude_Master_Prompt.md`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000; needs `.env.local` (see `.env.example`) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check. If `.next/types` holds stale errors, delete that folder |
| `npm run build` | Production build |
| `npm test` | All tests: `tests/rls/*.test.mjs` + `tests/acceptance/*.test.mjs` |
| `npm run test:rls` | RLS tests only |
| `npm run test:acceptance` | Acceptance tests only |

Running a subset of tests:

- One file: `node --test tests/rls/phases.test.mjs`
- One test by name: `node --test --test-name-pattern="board" tests/rls/phases.test.mjs`
- Pre-009 schema: `RLS_UPTO=8 npm run test:rls` replays migrations only up to 008. It is expected to fail, which demonstrates the old vulnerabilities.

Supabase commands (the CLI is linked to project `dvpockrupiovuxcenuiy`, which is **production**; there is no staging project yet):

| Command | What it does |
|---|---|
| `npx supabase db push --dry-run` | Preview pending migrations. Always run before a real push |
| `npx supabase db push` | Apply pending migrations |
| `npx supabase migration list --linked` | Show which migrations are applied remotely |

## Tests run against PGlite, not Supabase

Docker isn't available, so there is no local Supabase stack. Instead, `tests/rls/harness.mjs` does the following:

- Boots PGlite (in-memory Postgres in WASM).
- Installs stand-ins for Supabase's `auth` and `storage` schemas, the API roles and the default grants.
- Replays every file in `supabase/migrations` in order.

It exposes these helpers:

- `createDatabase({ upto })`
- `as(db, user, sql)`, `rowsAs(...)` and `rejects(...)`, which run SQL as a given role/JWT
- `addMember()` and `newUser()`
- fixed `ids` and `users`

Any schema or policy change needs a test here. The stubs approximate Supabase; they don't cover Storage API or PostgREST behaviour.

## Architecture

**The database is the security boundary.**

- Every query in the app runs under the caller's own session. The only exception is the public site, which uses the anonymous client.
- **There is no service-role client.**
- Every table has RLS, with policies that call `has_permission('<key>')`.
- Checks are repeated in three layers, all reading the same matrix:
  1. RLS in the database.
  2. `requireApi(permission)` in `src/app/api/**` route handlers.
  3. `requirePage(permission)` in server pages.
- Hiding a navigation item (`src/features/dashboard/nav.ts`) is cosmetic only.

**Roles and permissions.**

- Authority comes only from `agency_members`. Its `user_id` is bound to `auth.uid()` by triggers, and binding requires a confirmed email.
- `profiles.role` and `profile_roles` are read-only mirrors that grant nothing.
- Permissions are data, stored in `permissions` and `role_permissions` (migration 011).
- `src/lib/agency-auth.ts` resolves user, membership and permissions once per request, cached through the `current_permissions()` RPC.
- `src/lib/permissions.ts` must list any new permission key.

**Column grants on `talent`.**

- `talent` is readable and writable only through explicitly granted columns: migration 012 for signed-in users, 017 for anon.
- A new column is invisible to the API until you grant it.
- Private fields (DOB, contact details) live in `talent_private_details`. The old copies still on `talent` are un-granted, pending a destructive contract migration.

**Public read path.**

- `src/features/public/queries.ts` uses `createPublicSupabaseClient()`, which is anonymous with no session.
- It reads only these `security_invoker` views: `public_boards_view`, `public_talents_view`, `public_talent_media_view`, `public_talent_portfolios_view` and `public_talent_skills_view`.
- Anon reads the underlying tables through anon-only policies on published rows, plus column grants.
- New public views must be `security_invoker`. A test asserts this.
- Hidden values (measurements when `show_measurements` is off, age unless `show_age`) are nulled in the views. Never filter or expose them through another route.

**Talent publication.**

- A talent is public when it is `publication_status = 'published'`, has `show_on_website`, and isn't archived.
- For board pages, the talent must also be assigned to a board that is public. A board is public when it and all its parents are active, published and not internal.
- A trigger enforces the `talent.publish` and `talent.archive` permissions and writes the audit events.
- `/models/[...path]` resolves either a board path (`/models/teens/boys`, the chain of `path_segment` values) or a talent slug.

**Media.**

- Uploads always go to the private `talent-private` bucket.
- "Make public" copies the file into `talent-public` and records `public_storage_path`. Withdrawing removes the copy.
- Documents live in `talent-documents` and are downloaded only through 60-second signed URLs, which are audited.

**Audit.**

- `audit_logs` is written only by database triggers and by the `write_audit()` function (`writeAudit()` in `src/lib/api.ts`).
- For sensitive modules (legal, banking, medical), triggers log changes **without values**. App-level audits log field names, not values.

**Dashboard pattern.**

- Server pages load data per request.
- Client components post to `/api/dashboard/*` using `useMutation()` (`src/lib/use-mutation.ts`), which toasts and then calls `router.refresh()`.
- Route handlers validate input with Zod and return errors through `databaseError()`, which logs server-side and returns a generic message.
- The 16 per-talent tabs are driven by one registry:
  - `src/features/talent/modules.ts`: table, view/edit permission and Zod schema per module, served by `api/dashboard/talents/[id]/records/[module]`.
  - `src/features/talent/fields.ts`: forms and table columns.
- To add a module, extend both registries rather than writing new routes.

**Spec → schema names.** The existing tables were kept rather than duplicated:

| Spec name | Table in this repo |
|---|---|
| `talents` | `talent` |
| `talent_boards` | `talent_board_assignments` |
| `talent_images` | `talent_photos` |
| `talent_financial` | `talent_banking` |
| `documents` | `talent_documents` |
| `talent_measurement_history` | `talent_measurements` |

## Conventions and gotchas

- **Next 16 proxy.** `middleware.ts` is replaced by `src/proxy.ts`, which must sit next to `src/app`. It refreshes the session and gates `/dashboard`, `/preview` and `/login`.
- **Migrations.** Use numbered files (`NNN_name.sql`), additive and idempotent (expand/contract). Never edit production tables by hand.
  - Destructive changes (dropping columns or data) need a backup and explicit owner approval first.
  - The advisor-clean pattern:
    - Trigger functions get no EXECUTE for API roles.
    - `security definer` helpers set `search_path`.
    - Anon can't call role helpers.
- **Tailwind v4.** Numeric weights (`font-600`, `font-800`) only work because `globals.css` defines `--font-weight-*` tokens.
  - Base styles must stay in `@layer base`, or they override utilities.
  - Arbitrary `calc()` needs underscores: `w-[calc(100%_-_32px)]`.
- **Layout overflow.**
  - An `sr-only` element inside an `overflow-x-auto` container needs a `relative` ancestor, or it widens the page on mobile.
  - Grid children need `min-w-0`.
- **Secrets.** `src/lib/env.ts` refuses a secret key in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `SUPABASE_SECRET_KEY` is currently unused. `.env*` files are gitignored, except `.env.example`.
- **Contact email and branding.** The contact email is `CONTACT_EMAIL` in `src/lib/site.ts`. The brand name is "42 Model Management" (not "Agency OS").
- **Git.** The owner has authorised pushing directly to `main` (Vercel deploys from it) and running `supabase db push`.
