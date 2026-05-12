# @second-brain/web

Next.js 16 (App Router) front-end for the second-brain monorepo.

## Prerequisites

- [Bun](https://bun.sh/) ≥ 1.0
- [Docker](https://docs.docker.com/get-docker/) (used by the Supabase local stack)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) ≥ 2.98

## Local Supabase stack

The repo ships a Supabase project at `supabase/` with the base multi-tenant
schema (`teams`, `user_profiles`, `team_members`, `team_invitations`, `agents`)
and Row-Level Security enabled on every table.

### Start the stack

```bash
# from repo root
supabase start
```

This boots Postgres, Auth, Studio, etc. on local ports and prints the
generated API URL, anon key, and service-role key. Copy the relevant values
into `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from `supabase start`>
SUPABASE_SERVICE_ROLE_KEY=<service-role key from `supabase start`>
```

### Reset the database

`supabase db reset` drops the local database, replays every file in
`supabase/migrations/` in order, and finally runs `supabase/seed.sql`.

```bash
supabase db reset
```

After a reset you can sign in to Supabase Studio (`http://127.0.0.1:54323`)
as the seeded dev user:

- email: `dev@second-brain.local`
- password: `devpassword`

The seed also creates a dev team (`slug = "dev"`) and a dev agent (`name = "dev-cli"`)
so the CLI and web app have something to talk to immediately.

### RLS quick reference

Team-scoped tables are guarded by `app_current_team()`, which reads the
`app.team_id` GUC. `app_set_team()` sets it as a **transaction-local**
setting, so it must be called inside the same transaction as the queries
that depend on it. This prevents the team context from leaking across
pooled connections (Supavisor transaction mode, PgBouncer, etc.).

```sql
begin;
select public.app_set_team('<team-uuid>');
-- ... team-scoped queries here ...
commit;
```

For PostgREST clients (supabase-js), put both the `app_set_team` call and
the dependent query inside a single RPC function so they share a
transaction. `app_set_team()` verifies that the calling user (`auth.uid()`)
is a member of the target team before flipping the GUC. Helper predicates:

| Function | Returns |
| --- | --- |
| `app_current_team()` | active team UUID or `null` |
| `app_is_team_admin()` | `true` if `auth.uid()` is `owner` or `admin` of active team |
| `app_is_team_owner()` | `true` if `auth.uid()` is `owner` of active team |

User-scoped tables (`user_profiles`) are guarded directly by `auth.uid()`.

## Web app

```bash
# from repo root
bun install
bun run dev:web
```

The dev server listens on <http://localhost:3000>.
