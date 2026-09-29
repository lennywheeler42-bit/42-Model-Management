# Security review status

## Controls implemented

- Supabase service-role key is not referenced by client code.
- Sensitive talent details are separate from public talent core.
- Publication requires both a published status and explicit website visibility.
- Role helper functions and RLS policies are migration-defined.
- A public-safe view is used instead of exposing private table columns.
- Environment values are documented in `.env.example` and are not committed.

## Release blockers before production

- Connect and test the real Supabase project.
- Add storage bucket policies for public/private/document/application buckets.
- Add server-side auth middleware and server client usage for every protected mutation.
- Add upload validation, rate limiting, HTML sanitization, audit writes, and error monitoring.
- Run role-by-role RLS tests and confirm the public view cannot leak private records.

