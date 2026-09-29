# Launch checklist

- [ ] Staging environment has separate Supabase URL, keys, Auth users, and Storage.
- [ ] All migrations replay cleanly on a blank and populated staging database.
- [ ] Auth, role resolution, RLS, and storage policies pass role-based tests.
- [ ] Public board/profile publication acceptance test passes, including unpublish and board removal.
- [ ] Application, media, CMS, and dashboard workflows are connected to live data.
- [ ] `npm run lint` and `npm run build` pass in CI.
- [ ] Accessibility, mobile, SEO, media performance, and browser QA are complete.
- [ ] Backup, rollback, domain, environment, and monitoring plans are documented.
- [ ] No test credentials, fictional data, or service-role key are present in production.

