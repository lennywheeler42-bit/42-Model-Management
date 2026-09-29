# 42 Agency OS

Production-oriented talent management software for 42 Model Management. The project includes a public editorial website, a Supabase-backed talent directory, authenticated agency dashboard workflows, Google OAuth, and storage-backed public media.

## Routes

- `/` — public editorial homepage
- `/models` — searchable public talent directory
- `/models/[slug]` — public talent profile
- `/login` — email/password and Google sign-in
- `/dashboard` — authenticated agency dashboard

Public pages read only from approved Supabase views. Draft, private, legal, financial, and internal fields are not exposed through the public site.

## Stack

- Next.js 16 App Router
- React 19 and TypeScript
- Tailwind CSS 4
- Supabase Auth, Postgres, Row Level Security, database views, and Storage
- Zod validation for dashboard writes

## Requirements

- Node.js 20 or newer
- npm
- A Supabase project

## Local setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Set these values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://dvpockrupiovuxcenuiy.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
SUPABASE_SECRET_KEY=<server-only-secret-or-service-role-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The publishable/anon key is intended for browser use and is protected by Supabase RLS. Keep `SUPABASE_SECRET_KEY` server-only. Never prefix it with `NEXT_PUBLIC_`, commit it, or paste it into a client component.

## Supabase setup

The production Supabase project is `dvpockrupiovuxcenuiy`. Use API keys from this project only; a key from another Supabase project causes an `Invalid API key` error.

Link the project and apply the tracked migrations:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref dvpockrupiovuxcenuiy
npx supabase@latest db push
npx supabase@latest migration list
```

The migrations safely extend the existing agency schema with role helpers, talent fields and policies, public directory/profile views, storage buckets, and Auth profile bootstrapping. Add future schema changes as new files under `supabase/migrations`; do not edit production tables manually.

## Google sign-in

Enable **Authentication → Providers → Google** in Supabase and enter the Google OAuth Client ID and Client Secret.

In Google Cloud, create a **Web application** OAuth client and add this exact authorized redirect URI:

```text
https://dvpockrupiovuxcenuiy.supabase.co/auth/v1/callback
```

In **Supabase → Authentication → URL Configuration**, set the Site URL to the real Vercel production domain and add these redirect URLs:

```text
http://localhost:3000/auth/callback
https://<your-vercel-domain>/auth/callback
```

Google sign-in authenticates a user but does not grant an agency role. After the intended owner signs in once, run this query in Supabase SQL Editor, replacing the email:

```sql
update public.profiles
set role = 'owner', status = 'active'
where lower(email) = lower('owner@youragency.com');

insert into public.profile_roles (profile_id, role_id)
select p.id, r.id
from public.profiles p
join public.roles r on r.key = 'owner'
where lower(p.email) = lower('owner@youragency.com')
on conflict do nothing;
```

Do not grant `owner` to every Google account. Use least-privilege staff roles such as `administrator`, `talent_manager`, `booker`, `creative`, `accounting`, or `read_only`.

## Media and publishing flow

1. Create talent from the authenticated dashboard.
2. Add measurements, board assignments, and media in Supabase.
3. Upload approved public media to the `talent-public` bucket.
4. Set the talent record to `published` and enable `show_on_website`.
5. Confirm the record appears in `/models` and its public profile route.

Records remain private until they are explicitly published. An empty roster is expected immediately after a fresh schema deployment.

## Vercel deployment

Connect the GitHub repository `lennywheeler42-bit/42-Model-Management` with the `main` branch. Configure these Vercel environment variables for Production and Preview:

```env
NEXT_PUBLIC_SUPABASE_URL=https://dvpockrupiovuxcenuiy.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<matching-publishable-key>
SUPABASE_SECRET_KEY=<matching-server-only-secret>
NEXT_PUBLIC_SITE_URL=https://<your-vercel-domain>
```

Use `Config` for variables beginning with `NEXT_PUBLIC_` and `Secret` for `SUPABASE_SECRET_KEY`. The build command is `npm run build`; leave the Next.js output directory and install command at their defaults. After changing Vercel environment variables, redeploy because they apply only to new deployments.

## Quality checks

```bash
npm run lint
npm run build
npm run start
```

After deployment, smoke-test `/`, `/models`, `/login`, `/dashboard`, Google sign-in, and one published talent profile.

## Documentation

- [Database notes](docs/database.md)
- [Architecture](docs/architecture.md)
- [Security review](docs/security-review.md)
- [Staging guidance](docs/staging.md)
- [Launch checklist](docs/launch-checklist.md)
- [Discovery notes](docs/discovery.md)

## License

Private project for 42 Model Management.
