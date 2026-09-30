# Project handoff — 42 Model Management

_Last verified: 2026-10-01._

This is the single place to pick the project up. Detail lives in:
- `ROADMAP.md`: phases and production-readiness criteria
- `launch-checklist.md`: release steps
- `qa-report.md`
- `architecture.md`
- `database.md`
- `permissions.md`
- `security-review.md`
- `operations.md`
- `ghl-integration.md`
- `staging.md`: the single-project release process

The spec (`42_Agency_OS_Claude_Master_Prompt.md`) lives outside the repo.

## 1. Status at a glance

| Item | State |
|---|---|
| Roadmap phases | **0–17 built and live.** Everything is on `main` (tag `v1.0.0-rc.1` marks the Phase 17 release candidate) |
| Supabase | One project only (owner decision): `dvpockrupiovuxcenuiy`. **Migrations 001–025 applied** |
| GitHub | `lennywheeler42-bit/42-Model-Management`. Work goes straight to `main`. The old `release/phases-11-17` branch is fully merged and no longer used |
| Hosting | Vercel (team `model-luxe-media`) builds `main`. Live at `https://42-model-management-kappa.vercel.app` until the custom domain is attached |
| Tests | 209 database/unit tests, 64 browser tests (desktop + mobile), axe WCAG AA, Lighthouse. All green (`qa-report.md`) |
| Join Us | Stays on GoHighLevel (`https://funnel.modelluxemedia.com/registration-form`). Submissions flow in via webhook and import script |
| Email sender | `ghl@modelluxemedia.com`, configured as custom SMTP in Supabase (owner action) |

## 2. What each phase delivered

| Phase | Delivered | Migration |
|---|---|---|
| 0–8 | Audit, security fix, permissions, dashboard, talent, boards, profile modules, media, sensitive modules, public site | 009–018 |
| 9 Release foundation | CI, Playwright, error logging and alerts, password reset, sign-in audit, contract step for old private columns, security headers, 404/error pages, seed, operations runbook | 019 |
| 10 Public search | URL-driven roster filters (leak-proof), pagination, cached public reads with instant invalidation | — |
| 11 Applications (GHL) | Webhook and import script, review queue, convert to draft talent (with photos), duplicates, retention | 020 |
| 12 CMS | Pages with published revisions, blocks (hero, text, image, video, CTA, talent/board grids, contact, sanitised HTML/CSS), navigation, settings, redirects, media library, preview; legal page drafts; brand palette; settings-driven home page | 021 |
| 13 Operations | Companies, contacts, bookings with double-booking warnings, calendar, tasks, finance (fees separate, CSV), `.ics` export | 022 |
| 14 Packages | Client packages with hashed, expiring, revocable links; PDF comp cards; roster CSV | 023 |
| 15 Talent portal | Magic-link portal: profile, change requests, digitals, availability, bookings, shared documents; staff review queue | 024 |
| 16 Security | Schema-wide generated security tests, anon grant cleanup, CSP, MFA for owner/admin, permission-matrix editor, data-subject export/erase | 025 |
| 17 QA | Contrast fixes, heading order, canonical URLs, QA report, launch checklist, RC tag | — |

## 3. What to do next (owner)

Done: migrations 019–025 applied, code merged to `main` and deployed, Vercel env vars (`SUPABASE_SECRET_KEY`, `GHL_WEBHOOK_SECRET`) set.

Remaining from **`launch-checklist.md` §1**:
1. Import past GHL applications (`ghl-integration.md` §3). Choose only the forms that are real applications.
2. Configure Supabase Auth (SMTP, templates, leaked-password protection).
3. Set up MFA for owner and admins.
4. Create the GHL workflow for new submissions.
5. Run the smoke test.

Then work through §2 (content and legal pages) and §3 (domain cutover).

After that, the remaining unverified items are listed in `qa-report.md` → "Not yet verified". They need real data and accounts.

## 4. Key decisions (so they are not re-litigated)

- **One Supabase project.** `staging.md` explains the safeguards that replace staging.
- **Push directly to `main`**, no PRs (owner). Migrations are validated on PGlite and dry-run first.
- **Join Us stays on GHL;** our system mirrors it. One application per GHL contact.
- **Service role** is used only by the GHL webhook (`src/lib/supabase/admin.ts`), enforced by `tests/unit/boundaries.test.mts`.
- **Minors:** no public DOB, address or contacts; no structured data about talent; guardian required.
- **CSP without nonces,** so static pages keep working. CMS HTML is sanitised.
- **MFA required** for owner and administrator (`MFA_REQUIRED_ROLES`).
- **Brand accent:** burgundy `#9e1923` and gold `#d5a561` (public); dashboard accent `#a4502f`.

## 5. Open owner decisions

- Legal text for Privacy and Terms; application retention period.
- Finance scope (no invoicing today). Whether to keep the Medical module.
- Small label sizes (Lighthouse "legible font sizes").
- Supabase plan with backups (Pro recommended before real talent data). External penetration test.
