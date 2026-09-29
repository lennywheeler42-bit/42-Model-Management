# Project handoff — 42 Model Management

_Last verified against the codebase: 2026-09-30, at commit `cf86e57` on `main` (same as `origin/main`)._

This is the single place to pick the project up. The detail lives in the linked docs; this file says what is done, what is live, and what to do next.

- **Spec:** `42_Agency_OS_Claude_Master_Prompt.md` and `42_Agency_OS_Codex_Build_Prompt.md`. They are kept outside the repo, in the parent folder. Phases are in §53, staging per phase in §58, and the definition of done in §61.
- **Detail docs:**
  - `architecture.md`
  - `database.md`
  - `permissions.md`
  - `security-review.md`
  - `staging.md`
  - `discovery.md` (the Phase 0 audit)
  - `launch-checklist.md`

## 1. Status at a glance

| Item | State |
|---|---|
| Phases complete | **0–8** |
| Next phase | **9: Search and Filtering**, after the review gate in §9 |
| GitHub | `lennywheeler42-bit/42-Model-Management`, branch `main`. Pushed directly, with no PRs, at the owner's request. |
| Hosting | Vercel builds from `main` |
| Supabase | Production project `dvpockrupiovuxcenuiy`. Migrations **001–018 applied** (checked with `supabase migration list --linked`). |
| Staging | **Does not exist yet.** See §8. |
| Tests | `npm test`: **94/94 pass** (RLS, per-phase behaviour, and the Saih acceptance test) |
| Build health | Type check, lint and production build were clean at `cf86e57` |
| Supabase advisor | 0 errors. The remaining warnings are deliberate or dashboard settings (§8). |

### Commit history

| Commit | Contents |
|---|---|
| `7f69b32` | Phase 1b security hardening (migration 009) |
| `b1c0c26` | Security-definer view fix (010), the permissions foundation (011), and the dashboard shell (Phases 1–2) |
| `f1ef737` | Phases 3–8: talent core, boards, profile modules, media, sensitive modules, public board pages and previews (012–018) |
| `cf86e57` | Dashboard UI/UX fixes, "Model Management" branding, and the contact email `lenny@42modelmanagement.com` |

## 2. Completed phases

| Phase | Delivered | Where |
|---|---|---|
| 0 Discovery | Repo and Supabase audit, risks, decisions | `docs/discovery.md` |
| 1 Supabase foundation | See the two rows below | Migrations 009, 010, 011, 018 |
| 1b Security fix | S1 self-escalation, S2 public bucket listing, S3 `audit_log` RLS, S4 DOB in public views, S7 error leaks | 009 and `security-review.md` |
| 1 Permissions | Permission tables and the data-driven role matrix; `has_permission()`, `current_permissions()`, `current_talent_id()`; policies rebuilt on permissions | 011 |
| 2 Dashboard shell | Server-enforced, route-based dashboard: role-aware navigation, UI kit, loading/error states, global search, Settings (team, roles matrix) | `src/app/dashboard`, `src/features/dashboard`, `src/components/ui` |
| 3 Talent core | See the two rows below | 012, `src/features/talent` |
| 3 Records | Talent list and create; General tab; visibility flags; minor and guardian fields; archive and restore | 012 |
| 3 Private data and rates | Private fields moved to `talent_private_details`, with a publish/archive permission trigger; multiple phones and emails; rates | 012 |
| 4 Boards | Board tree (`path_segment`, cycle and depth guards); CRUD, reorder, publish and deactivate; multi-board assignment; audit | 013, `src/features/boards` |
| 5 Profile modules | Measurement history plus a current view, skill catalogue, contacts, addresses, agencies | 014 |
| 6 Media | Photos go to private storage first, then "Make public" copies them. Reorder, featured photo, metadata, archive; videos (embed or file); portfolios and digital books | 015, `src/features/media` |
| 7 Sensitive modules | Legal, banking (masked, audited reveal), medical (own permissions), documents (private bucket, 60 s signed download, archive rather than delete); value-free audit triggers | 016 |
| 8 Public website | See the two rows below | 017, `src/features/public`, `src/app/models` |
| 8 Pages | `/models` roster with two-level board chips; `/models/[...path]` board pages and profiles; `/preview/talent/[id]` staff preview | 017 |
| 8 Views and SEO | Public-safe `*_view` views; sitemap and robots | 017 |
| QA / UI pass | Tailwind weight tokens, form styling, mobile overflow, dialog focus, activity labels, board URLs, branding | `cf86e57` |

**Saih acceptance test:** passes at database level (`tests/acceptance/saih.test.mjs`). It covers create, assign boards, add media, publish, public visibility, unpublish, board removal and anonymous isolation. It has **not** yet been run by hand in a browser with a real signed-in account (§8).

## 3. Supabase / database setup

- **Project:** `dvpockrupiovuxcenuiy`. It is the only project, and it is production.
- **Migrations** (`supabase/migrations`, all applied):

  | Migrations | Contents |
  |---|---|
  | 001–008 | The original schema: profiles, talent, boards, 16 talent modules, allowlist, storage |
  | 009 | Security hardening: membership bound to `auth.uid()`, locked profiles, audit, private-first media |
  | 010 | Public views changed to `security_invoker` (advisor lint 0010 hotfix) |
  | 011 | Permissions |
  | 012 | Talent core |
  | 013 | Boards |
  | 014 | Profile modules |
  | 015 | Media |
  | 016 | Sensitive modules |
  | 017 | New public views; the 010 views are dropped |
  | 018 | Function EXECUTE revokes; search_path fix |

- **Roles and access:**
  - Authority comes **only** from `agency_members` (status `active`, `user_id = auth.uid()`). The binding trigger requires a confirmed email.
  - `profiles.role` and `profile_roles` are read-only mirrors.
  - The last active owner cannot be demoted or removed.
  - The owner-recovery SQL is in the README.
- **Permissions:** `permissions` and `role_permissions`. RLS calls `has_permission('<key>')`. The matrix is data: the owner can change it without a deploy. See `permissions.md`.
- **Public read path:** anon reads only these `security_invoker` views, through anon-only policies and column grants on published rows:
  - `public_boards_view`
  - `public_talents_view`
  - `public_talent_media_view`
  - `public_talent_portfolios_view`
  - `public_talent_skills_view`

  Age comes from `talent_public_age()` (opt-in). The DOB is never exposed.
- **Storage buckets:** `talent-public`, `talent-private`, `talent-documents`, `applications`, `comp-cards`, `cms-media`. All have size and MIME limits, and anon cannot list them.
- **Audit:** `audit_logs` is written only by triggers and `write_audit()`. The legacy `audit_log` is read-only.
- **Column grants on `talent`:** a new column is invisible to the API until it is granted: 012 for signed-in users, 017 for anon. **Remember this when adding columns.**

## 4. Architecture and naming decisions

- **Spec table names are mapped, not duplicated:**

  | Spec name | This schema |
  |---|---|
  | `talents` | `talent` |
  | `talent_boards` | `talent_board_assignments` |
  | `talent_images` | `talent_photos` |
  | `talent_financial` | `talent_banking` |
  | `documents` | `talent_documents` |
  | `talent_measurement_history` | `talent_measurements` |

  The current-measurements view is `talent_current_measurements`.
- **No service-role client in the app.** Every query runs as the caller, so RLS is always the boundary. `src/lib/env.ts` refuses a secret key in the public variable.
- **Three-layer checks:** RLS `has_permission()`, then API `requireApi()`, then page `requirePage()`. Navigation hiding is cosmetic (`src/features/dashboard/nav.ts`).
- **Public site** uses `createPublicSupabaseClient()` (anon, no session) and renders per request, so publishing shows immediately.
- **Next.js 16:** `src/proxy.ts` replaces `middleware.ts` and must sit next to `src/app`. Read `node_modules/next/dist/docs/` before using unfamiliar APIs (see `AGENTS.md`).
- **Migrations are additive (expand/contract).** Data is never deleted. Old `talent` private columns remain but cannot be reached; they are dropped later.
- **Talent sub-modules** are driven by one registry: `features/talent/modules.ts` (API) and `features/talent/fields.ts` (forms and tables).
- **Board URLs** are the chain of `path_segment` values (`/models/teens/boys`). A board is public only if it and every parent is active, published and not internal.
- **Branding:** the dashboard logo reads "42" plus "Model Management", not "Agency OS". The contact email is the `CONTACT_EMAIL` constant in `src/lib/site.ts`.
- **Tailwind v4:** numeric weights such as `font-800` need the `--font-weight-*` tokens in `globals.css`. Base styles sit in `@layer base` so utilities win.

## 5. Files — where things are

- **Database:**
  - `supabase/migrations/009`–`018`: all new since the audit.
- **Tests** (PGlite in-memory Postgres with Supabase stand-ins):
  - `tests/rls/harness.mjs`
  - `security.test.mjs`
  - `phases.test.mjs`
  - `public-views.test.mjs`
  - `tests/acceptance/saih.test.mjs`
- **Auth and data:**
  - `src/lib/agency-auth.ts`: request context, `requireApi`, `requirePage`
  - `src/lib/permissions.ts`
  - `src/lib/supabase/{client,server,proxy,public}.ts`
  - `src/proxy.ts`
- **Helpers:**
  - `src/lib/{env,api,validation,read-form,use-mutation,format,site}.ts`
- **UI kit:**
  - `src/components/ui/`: Button, Field, PageHeader/Card, States, Badge, Dialog, Toast, DataTable, Thumb
- **Dashboard features:**
  - `src/features/dashboard/`: frame, navigation, overview, activity labels
  - `src/features/talent/`: registry, schemas, queries, and the tab components
  - `src/features/boards/`: tree, manager, assignments
  - `src/features/media/`: photos, videos, collections
  - `src/features/settings/TeamPanel.tsx`
- **Public site:**
  - `src/features/public/`: queries, types, profile view, preview builder
  - `src/components/SiteHeader.tsx`: menu built from public boards
  - `src/components/TalentCard.tsx`
- **Routes:**
  - Dashboard pages: `src/app/dashboard/**`
  - Dashboard API: `src/app/api/dashboard/**`, covering talents, records, boards, publication, media, documents, banking reveal, team
  - Public pages: `src/app/models/**`, `src/app/preview/talent/[id]`, `sitemap.ts`, `robots.ts`, home `page.tsx`
- **Removed:** `src/lib/data.ts`, `src/lib/live-data.ts`, the old `DashboardShell`/`TalentEditor`, `src/app/models/[slug]`, and old API routes.
- **Local only (untracked):** `.claude/launch.json`, the dev-server config for the preview tool.

## 6. Features working now

- **Public:**
  - Home page.
  - `/models` roster with board chips and name search.
  - Board pages (`/models/<board>/<sub>`).
  - Talent profiles showing photos, videos, portfolios, skills, and measurements when allowed, plus age when opted in.
  - Sitemap and robots.
- **Staff:**
  - Sign-in by email/password or Google, for allowlisted accounts only.
  - Dashboard overview with recent activity.
  - Talent list and create.
  - The 16-tab talent editor.
  - Publish, unpublish, archive and restore.
  - Staff preview of the public profile.
  - Board management and assignment.
  - Photo, video and collection management.
  - Document upload and signed download.
  - Banking reveal, which is logged.
  - Global search over talent and boards.
  - Team management and a read-only permissions matrix.
- **Placeholders ("Soon"):** Calendar, Tasks, Companies, Contacts, Finance (Phase 12), Packages (Phase 13), Website (Phase 11).

## 7. Environment and configuration

- **Variables:** `.env.example` is the template. Real values go in `.env.local` locally, and in Vercel per environment. `.env*` is gitignored, and a secret scan was clean at every push.

  | Variable | Notes |
  |---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | Required |
  | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Required. The legacy name `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted. |
  | `NEXT_PUBLIC_SITE_URL` | Canonical URLs and sitemap |
  | `SUPABASE_SECRET_KEY` | Server-only and **currently unused** by the app |

- **Supabase Auth:** email confirmation must stay on, because membership binding trusts confirmed emails. Google provider settings and redirect URLs are in the README.
- **CLI:** `npx supabase@latest link --project-ref dvpockrupiovuxcenuiy`, then `db push --dry-run` before `db push`.
- **Commands:**

  | Command | Purpose |
  |---|---|
  | `npm run dev` | Development server |
  | `npm test` | All tests |
  | `npm run test:rls` | RLS tests only |
  | `npm run lint` | Lint |
  | `npx tsc --noEmit` | Type check |
  | `npm run build` | Production build |

- **Tools:** Docker is not installed, so there is no local Supabase stack. Tests use PGlite instead.

## 8. Unresolved issues, blockers and incomplete work

1. **No staging project.** Everything was validated on PGlite and pushed straight to production at the owner's request. The spec's staging workflow (§58) cannot be followed until one exists; see `staging.md`.
2. **Signed-in flows are unverified with real data.** The dashboard was only reviewed through a simulated preview with fictional data. Walk through these with a real account:
   - uploads to `talent-private`
   - "Make public" copies
   - signed document downloads
   - banking reveal
   - the full Saih workflow
3. **Supabase dashboard settings (owner action):**
   - Enable **leaked-password protection** (Authentication → Settings).
   - Review the pre-existing `rls_auto_enable()` function. It predates the tracked migrations and its origin is unknown.
4. **Legacy media.** Photos uploaded before 009 still sit in the `talent-public` bucket. They cannot be listed, but anyone with the URL can open them. They need a one-off copy-then-verify move to `talent-private`.
5. **Contract step pending.** The old private columns on `talent` (`date_of_birth`, `mobile`, `email` and others) are still present, though unreachable. Drop them in a later migration once the copy into `talent_private_details` is confirmed.
6. **Open owner decisions** (`discovery.md` §11):
   - Whether applications replace or sync with the GoHighLevel "Join Us" funnel. This is needed for Phase 10.
   - Whether to keep the medical module. It is currently limited to owner and administrator.
   - Brand palette and founding facts for the public site.
7. **Not built yet:** Phases 9–16 and the placeholder dashboard sections in §6. Rate limiting and upload-abuse controls are also missing; they are needed before the public forms of Phase 10.
8. **Launch checklist** (`launch-checklist.md`): not yet ticked. It depends on items 1–2 above.

## 9. What to do next

**Immediate task: close the Phase 1–8 review gate.** The spec says not to start Phase 9 until Phases 1–8 are reviewed and the Phase 8 acceptance workflow passes.

1. The owner reviews the live site and dashboard.
2. Run the Saih workflow by hand on production with a real account (§8 item 2).
3. Fix anything that turns up.
4. Do the owner actions in §8 item 3.
5. Ideally, create the staging project first so Phase 9 onwards follow the spec's staging flow.

**Then Phase 9: Search and Filtering** (spec §53, "PHASE 9").

- **Goal:** public talent discovery with combinable filters: board, gender, age, height, hair, eyes, waist, hips, ethnicity, location and skills. Add pagination and shareable URLs, backed by suitable indexes.
- **Starting point:** `src/app/models/ModelsDirectory.tsx` currently filters on the client by name and board only.
- **Suggested approach:**
  - Move filtering to URL search params.
  - Query `public_talents_view` joined to `public_talent_skills_view` and the measurement columns on the server, with pagination.
  - Add any filter-supporting indexes in migration `019_*`.
  - Measurements must only be filterable when `show_measurements` allows it, so filtering never leaks hidden values.
- **Before pushing:** extend `tests/rls/public-views.test.mjs`.

**Spec order after Phase 9:**

1. Phase 10: Applications / Join Us
2. Phase 7 hardening
3. Phase 11: CMS / Website Builder
4. Phase 12: Bookings, Usage, Calendar, Tasks
5. Phase 13: Comp Cards and Exports
6. Phase 14: Talent Portal
7. Phase 15: Security Hardening
8. Phase 16: QA and Production Readiness

**Release routine for each phase:**

1. Run `npm test`, `npx tsc --noEmit`, `npm run lint` and `npm run build`.
2. Run the secret scan.
3. Run `supabase db push --dry-run`, then `supabase db push`.
4. Push `main`. Vercel deploys it.
5. Re-run the Supabase advisor.
