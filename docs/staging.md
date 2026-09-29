# Staging process

## Environments

- Local: Next.js local server plus local/dedicated development Supabase.
- Staging: separate Supabase project, auth users, storage buckets, and safe fictional data.
- Production: locked credentials, verified backups, controlled migrations, and monitored deployment.

## Promotion flow

`feature/*` → local checks → review → clean migration rehearsal → staging deploy → staging QA → security check → approval → production migration/deploy → smoke test.

The current repository has no connected staging project. Before production, configure environment variables, run the migrations on a clean and populated staging database, and verify RLS with anonymous, talent, creative, accounting, administrator, and owner roles.

