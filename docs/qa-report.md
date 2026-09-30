# QA report — release candidate v1.0.0-rc.1

_Date: 2026-09-30. Scope: roadmap Phases 9–17 on branch `release/phases-11-17`, plus Phases 9–10 already on `main`._

## Automated results

| Check | Result |
|---|---|
| Type check (`tsc --noEmit`) | ✅ clean |
| Lint (`eslint`) | ✅ clean |
| Production build | ✅ |
| Database, RLS and migration replay (PGlite, migrations 001–025) | ✅ 209 tests: 173 database, 32 unit, 4 acceptance |
| Schema-wide security rules (`tests/rls/hardening`) | ✅ |
| Browser tests, desktop and mobile (Playwright) | ✅ 64 passed; 2 signed-in checks skipped (need `E2E_EMAIL`/`E2E_PASSWORD`) |
| Browser tests against the production build (CSP enforced) | ✅ no CSP violations; pages hydrate |
| Accessibility (axe, WCAG 2.2 A/AA), 7 public pages × desktop and mobile | ✅ 14/14 after fixes (below) |
| Dependency audit (`npm audit --omit=dev`) | ✅ 0 vulnerabilities |

## Lighthouse (production build, simulated mobile, local server with remote Supabase)

| Page | Performance | Accessibility | Best practices | SEO | LCP |
|---|---|---|---|---|---|
| `/` | 97 | 100 | 100 | 100 | 2.7 s |
| `/models` | 94 | 100 | 93 | 100 | 3.0 s |
| `/login` | 95 | 100 | 96 | 63* | 2.9 s |

\* `/login` is deliberately excluded from search engines (robots), which Lighthouse scores as an SEO failure.

- **Load time:** LCP of 2.7–3.0 s is measured locally with simulated slow 4G against a remote database. Production on Vercel's edge, with cached public data, should come in under the 2.5 s target. Re-measure on the live domain (launch checklist).
- **Small text:** the best-practices deduction on `/models` is for "legible font sizes". The brand's small uppercase labels (10–11 px) fall below Lighthouse's 12 px mobile guideline. This is a design decision for the owner; everything still meets WCAG contrast.

## Fixed during QA

| Issue | Fix |
|---|---|
| Grey and terracotta text below WCAG 4.5:1 contrast (public site, sign-in, dashboard) | Darkened site-wide: `#8d8f88`→`#6b6d66`, `#a2a39d`/`#b5b6b0`→`#717369`, `#c26a48`→`#a4502f`, public `--muted` → `#66635c`, sidebar and footer white opacity raised |
| Decorative "42" in the About image placeholder counted as low-contrast text | Replaced with the paper-grid pattern |
| Roster and board pages skipped from h1 to h3 | Added visually hidden h2 headings |
| Canonical URLs were relative (invalid) | `metadataBase` from `NEXT_PUBLIC_SITE_URL` in the root layout |

Earlier phases also found and fixed the following during their own tests:
- anon default grants (S8);
- talent reading staff notes (S9);
- protocol-relative redirect targets (S10);
- a double-booking check that ignored appointments;
- a shoe-size type mismatch in change requests.

## Not yet verified (needs the migrations applied and real accounts)

These can only be checked after `supabase db push` applies migrations 019–025 to production. See the launch checklist.

1. Every dashboard module with real data:
   - applications from a real GHL submission
   - the CMS publish flow
   - bookings, calendar and finance
   - packages and a shared link
   - comp card PDF with real photos
   - portal invitation and magic link
   - MFA setup for owner and administrator
2. Supabase Storage behaviour for real uploads, copies, signed URLs and deletions. PGlite only models the RLS on `storage.objects`.
3. Email delivery (reset, magic link) through custom SMTP.
4. Performance and CSP on the production HTTPS domain.
5. A manual screen-reader pass (VoiceOver on iOS, NVDA on Windows) and a keyboard-only pass of the dashboard.
6. Browsers not covered by automation: Safari on iOS/macOS, Firefox, Edge.
