# Launch checklist

The criteria that must be true before launch are listed in [ROADMAP.md → Production readiness](ROADMAP.md#part-4--production-readiness). This file covers the **release-day procedure** for each production release (spec §62–65).

## Before deploying

- [ ] Release candidate `vX.Y.Z-rc.N` passed staging QA, and the owner approved it in writing.
- [ ] Fresh database backup taken; point-in-time recovery window confirmed.
- [ ] Pending migrations reviewed with `npx supabase db push --dry-run`. Any destructive step has a backup of the affected data and explicit approval.
- [ ] Linked Supabase project is `dvpockrupiovuxcenuiy`. Vercel Production env vars are set and point at it.
- [ ] RLS and storage policies reviewed for this release. The advisor shows 0 errors.
- [ ] No test credentials, fictional data or service-role key in the build or repo (secret scan is green).
- [ ] Domain and `NEXT_PUBLIC_SITE_URL` are correct.
- [ ] Rollback noted: the previous Vercel deployment, the backup point, and any migration rollback steps.

## Deploy

1. `npx supabase db push`
2. Push or merge to `main`. Vercel deploys it.
3. Watch error monitoring and Vercel logs for 30 minutes.

## Smoke test (spec §64)

- [ ] Home page loads.
- [ ] Admin login works, and the dashboard and talent list load.
- [ ] A talent profile can be edited.
- [ ] An image uploads.
- [ ] A board assignment works.
- [ ] A public board page loads.
- [ ] A published talent profile loads.
- [ ] A private or draft talent remains private.
- [ ] The application form submits, once Phase 11 ships.
- [ ] Storage permissions behave: private files are not reachable by URL.
- [ ] No major console or server errors, and no protected data exposed.

## If something breaks

- **App:** promote the previous Vercel deployment.
- **Database:** migrations are additive unless noted, so roll forward with a fix migration. Restore from the backup point only if data was damaged. See `staging.md` → Rollback.
