# Permissions

Roles resolve **only** from `agency_members`, bound to the signed-in Auth user id (migration 009). `profiles.role` is a display mirror and grants nothing.

**Where permissions live:** each role holds permissions through `public.role_permissions` (migration 011). The same matrix is used in three places:

1. **Database:** RLS policies call `has_permission('<key>')`. This is the security boundary.
2. **API routes:** `requireApi('<key>')` in `src/lib/agency-auth.ts` returns 401/403 before touching data.
3. **Pages and navigation:** `requirePage('<key>')` renders the Unauthorized state server-side, and the navigation hides items the role cannot use. Hiding an item is never the security boundary.

**Changing the matrix:** it is data, so it can be changed without a deploy. The owner (`team.manage`) can insert or delete `role_permissions` rows. **Settings → Roles & permissions** shows the live matrix.

## Default matrix

✓ = granted. *Owner* holds every permission. *Administrator* holds every permission except `team.manage`.

| Permission | Talent mgr | Booker | Creative | Accounting | Staff | Read only | Talent |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| dashboard.access | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| talent.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | own record |
| talent.create / talent.edit | ✓ | ✓ | | | | | |
| talent.publish | ✓ | | | | | | |
| talent.archive | ✓ | | | | | | |
| talent.private.view | ✓ | ✓ | | ✓ | | | own record |
| talent.private.edit | ✓ | ✓ | | | | | |
| boards.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| boards.manage | ✓ | | | | | | |
| boards.assign | ✓ | ✓ | | | | | |
| measurements.edit | ✓ | ✓ | | | | | |
| skills.edit | ✓ | ✓ | | | | | |
| agencies.manage | ✓ | | | | | | |
| notes.view | ✓ | ✓ | | | ✓ | | |
| notes.edit | ✓ | ✓ | | | | | |
| media.view | ✓ | ✓ | ✓ | | ✓ | ✓ | own record |
| media.manage | ✓ | | ✓ | | | | |
| legal.view / legal.edit | | | | ✓ | | | |
| banking.view / banking.edit | | | | ✓ | | | |
| medical.view / medical.edit | | | | | | | |
| documents.view / documents.manage | ✓ | | | ✓ | | | |
| operations.view | ✓ | ✓ | | ✓ | ✓ | ✓ | own appointments |
| operations.manage | ✓ | ✓ | | | | | |
| finance.view / finance.manage | ✓ | ✓ | | ✓ | | | |
| applications.view | ✓ | ✓ | | | | | |
| applications.manage | ✓ | | | | | | |
| website.manage, website.publish, audit.view, settings.manage | | | | | | | |
| team.manage | owner only | | | | | | |

## Notes on the defaults

- **Publishing:** a trigger enforces `talent.publish` and `talent.archive` on the columns involved, so a role that may edit details cannot publish, and the reverse.
- **Medical:** records are limited to owner and administrator. Grant `medical.view` to other roles only if the business needs it.
- **Talent logins** (`role = 'talent'`, linked through `agency_members.talent_id`) can read only their own talent record and its approved sub-records. They cannot open the staff dashboard. The talent portal itself is Phase 14.
- **Anonymous visitors** have no permissions. They read the public views through anon-only RLS policies over published rows, with column grants limited to public-safe fields (migrations 010 and 017).
