# Staging process

## Environments

| Environment | Supabase project | App | Branch |
|---|---|---|---|
| Local | PGlite (automated RLS and migration tests); a local Supabase stack needs Docker | `npm run dev` | `feature/*` |
| Staging | **Not created yet.** A separate project with its own keys, Auth users and Storage | Vercel Preview | `staging` or `feature/*` |
| Production | `dvpockrupiovuxcenuiy` | Vercel Production | `main` |

Each environment sets its own `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL` (see `.env.example`). Never point Preview deployments at the production project once staging exists.

## Promotion flow

1. **Feature branch:** implement, then run `npm run lint`, `npx tsc --noEmit`, `npm run test:rls` and `npm run build`.
2. **Migration rehearsal:** `npm run test:rls` replays every migration on a clean database. Also apply the migrations to a copy of production data in staging (`supabase db push` against the staging project).
3. **Staging QA:** check each role (owner, administrator, talent manager, booker, creative, accounting, read only) and anonymous access, then run the Saih acceptance test from the spec.
4. **Approval, then production:**
   - Take a database backup.
   - Run `supabase db push --dry-run`, then `supabase db push`.
   - Deploy `main` straight away.
   - Smoke-test.

**Ordering:** migrations 011 and 012 change grants that the previous app build relies on. Deploy the matching app build immediately after pushing them. Expect a few minutes of dashboard errors in between, but not on the public site.

## Current release plan (2026-09-30)

- **Hotfix, production-ready on its own:** `010_public_views_security_invoker.sql` fixes the Supabase advisor's Security Definer View findings. It keeps the views' columns, so the currently deployed site works unchanged. To apply it alone, while 011–017 are not yet approved, run:
  1. `npx supabase db query --linked -f supabase/migrations/010_public_views_security_invoker.sql`
  2. `npx supabase migration repair --status applied 010`
  3. Re-run the advisor in the Supabase dashboard.
- **Phase 1–2 release (this branch):** migrations 011–017 plus the new dashboard. **Hold until staging exists** and the phase review is approved.

## Rollback

- **App:** redeploy the previous Vercel deployment.
- **Database:** all migrations are additive, and no data is deleted.
  - 010 can be reverted by re-running the 009 view definitions.
  - 012 keeps the original `talent` columns, so re-granting them restores the old API surface.
  - Restore from the pre-push backup only if data was damaged.
