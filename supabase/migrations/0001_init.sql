-- 0001_init.sql
-- Base multi-tenant schema for second-brain.
-- Tables: teams, user_profiles, team_members, team_invitations, agents.
-- RLS keyed off app_current_team() (a GUC) for team-scoped tables and
-- auth.uid() for user-scoped tables. Helper functions set and read the
-- active team for the current Postgres session.

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.teams (
  id              uuid primary key default gen_random_uuid(),
  slug            citext not null unique,
  name            text not null,
  owner_user_id   uuid not null references auth.users(id) on delete restrict,
  plan            text not null default 'free',
  settings        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index teams_owner_user_id_idx on public.teams (owner_user_id);

create table public.user_profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  avatar_url      text,
  default_team_id uuid references public.teams(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index user_profiles_default_team_id_idx on public.user_profiles (default_team_id);

create table public.team_members (
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner', 'admin', 'member')),
  joined_at  timestamptz not null default now(),
  invited_by uuid references auth.users(id) on delete set null,
  primary key (team_id, user_id)
);

create index team_members_user_id_idx on public.team_members (user_id);

create table public.team_invitations (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  email       citext not null,
  role        text not null check (role in ('owner', 'admin', 'member')),
  token_hash  text not null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  invited_by  uuid not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now()
);

create index team_invitations_team_id_idx on public.team_invitations (team_id);
create index team_invitations_email_idx on public.team_invitations (email);
create unique index team_invitations_token_hash_unique on public.team_invitations (token_hash);

create table public.agents (
  id                  uuid primary key default gen_random_uuid(),
  team_id             uuid not null references public.teams(id) on delete cascade,
  name                text not null,
  api_key_hash        text,
  scopes              jsonb not null default '[]'::jsonb,
  created_by_user_id  uuid references auth.users(id) on delete set null,
  last_seen_at        timestamptz,
  active              boolean not null default true,
  revoked_at          timestamptz,
  created_at          timestamptz not null default now(),
  unique (team_id, name)
);

create index agents_team_id_idx on public.agents (team_id);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Returns the active team for this session, or NULL if unset.
create or replace function public.app_current_team()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.team_id', true), '')::uuid
$$;

-- Sets the active team for the current transaction after verifying the
-- caller is a member of that team. SECURITY DEFINER so the membership check
-- bypasses the RLS policy on team_members (which itself depends on
-- app.team_id).
--
-- The GUC is set with is_local=true so it is scoped to the current
-- transaction and cannot leak across pooled connections (Supavisor in
-- transaction mode, PgBouncer, etc.). Callers must therefore wrap
-- app_set_team() and the queries that depend on it in a single transaction.
create or replace function public.app_set_team(team uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'app_set_team: no authenticated user';
  end if;

  if not exists (
    select 1 from public.team_members
    where team_id = team and user_id = uid
  ) then
    raise exception 'app_set_team: user % is not a member of team %', uid, team;
  end if;

  perform set_config('app.team_id', team::text, true);
  return team;
end;
$$;

revoke all on function public.app_set_team(uuid) from public;
grant execute on function public.app_set_team(uuid) to authenticated, service_role;

-- Returns true when the current user is an owner or admin of the active team.
create or replace function public.app_is_team_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.team_members
    where team_id = public.app_current_team()
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  )
$$;

-- Returns true when the current user is the owner of the active team.
create or replace function public.app_is_team_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.team_members
    where team_id = public.app_current_team()
      and user_id = auth.uid()
      and role = 'owner'
  )
$$;

-- ---------------------------------------------------------------------------
-- Trigger: keep team_members in sync when a team is created
-- ---------------------------------------------------------------------------

-- When a team is inserted, automatically add the owner as a team_members row
-- with role='owner'. This avoids the chicken-and-egg problem with RLS
-- (the inserter cannot satisfy app_is_team_admin() before any rows exist).
create or replace function public.handle_new_team()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.team_members (team_id, user_id, role, invited_by)
  values (new.id, new.owner_user_id, 'owner', new.owner_user_id)
  on conflict (team_id, user_id) do nothing;
  return new;
end;
$$;

create trigger teams_owner_membership
after insert on public.teams
for each row execute function public.handle_new_team();

-- Refuse to remove or demote the last owner of a team so owner-only
-- actions (teams_update_owner / teams_delete_owner) can never become
-- permanently inaccessible.
create or replace function public.prevent_last_owner_removal()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  remaining_owners int;
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role is distinct from 'owner') then
    select count(*) into remaining_owners
    from public.team_members
    where team_id = old.team_id
      and role = 'owner'
      and user_id <> old.user_id;

    if remaining_owners = 0 then
      raise exception 'team % must retain at least one owner', old.team_id
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger team_members_protect_last_owner
before update or delete on public.team_members
for each row execute function public.prevent_last_owner_removal();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.teams              enable row level security;
alter table public.user_profiles      enable row level security;
alter table public.team_members       enable row level security;
alter table public.team_invitations   enable row level security;
alter table public.agents             enable row level security;

-- teams ---------------------------------------------------------------------
-- A user can see teams they belong to.
create policy teams_select_member
on public.teams for select
to authenticated
using (
  exists (
    select 1 from public.team_members m
    where m.team_id = teams.id and m.user_id = auth.uid()
  )
);

-- Anyone authenticated can create a team they own. The trigger above
-- adds the owner to team_members.
create policy teams_insert_self_owner
on public.teams for insert
to authenticated
with check (owner_user_id = auth.uid());

-- Owners (of the active team) can update / delete their team.
create policy teams_update_owner
on public.teams for update
to authenticated
using (id = public.app_current_team() and public.app_is_team_owner())
with check (id = public.app_current_team() and public.app_is_team_owner());

create policy teams_delete_owner
on public.teams for delete
to authenticated
using (id = public.app_current_team() and public.app_is_team_owner());

-- user_profiles -------------------------------------------------------------
create policy user_profiles_select_self
on public.user_profiles for select
to authenticated
using (user_id = auth.uid());

create policy user_profiles_insert_self
on public.user_profiles for insert
to authenticated
with check (user_id = auth.uid());

create policy user_profiles_update_self
on public.user_profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy user_profiles_delete_self
on public.user_profiles for delete
to authenticated
using (user_id = auth.uid());

-- team_members --------------------------------------------------------------
-- Users can see their own membership rows (so they can list teams), and
-- everyone in the active team can see fellow members.
create policy team_members_select_self_or_active_team
on public.team_members for select
to authenticated
using (
  user_id = auth.uid()
  or team_id = public.app_current_team()
);

-- Admins of the active team manage memberships, but they cannot touch
-- owner rows or promote anyone (including themselves) to owner. Promotion
-- to / demotion from 'owner' is reserved for existing owners. A BEFORE
-- trigger further guarantees the team always has at least one owner.
create policy team_members_insert_admin
on public.team_members for insert
to authenticated
with check (
  team_id = public.app_current_team()
  and public.app_is_team_admin()
  and role <> 'owner'
);

create policy team_members_update_admin
on public.team_members for update
to authenticated
using (
  team_id = public.app_current_team()
  and public.app_is_team_admin()
  and role <> 'owner'
)
with check (
  team_id = public.app_current_team()
  and public.app_is_team_admin()
  and role <> 'owner'
);

create policy team_members_delete_admin
on public.team_members for delete
to authenticated
using (
  team_id = public.app_current_team()
  and public.app_is_team_admin()
  and role <> 'owner'
);

-- Owners get unrestricted membership management for their team, including
-- promoting members to owner and demoting other owners. The
-- team_members_protect_last_owner trigger prevents removing the final
-- owner so a team can never be left without one.
create policy team_members_insert_owner
on public.team_members for insert
to authenticated
with check (team_id = public.app_current_team() and public.app_is_team_owner());

create policy team_members_update_owner
on public.team_members for update
to authenticated
using (team_id = public.app_current_team() and public.app_is_team_owner())
with check (team_id = public.app_current_team() and public.app_is_team_owner());

create policy team_members_delete_owner
on public.team_members for delete
to authenticated
using (team_id = public.app_current_team() and public.app_is_team_owner());

-- team_invitations ----------------------------------------------------------
create policy team_invitations_select_admin
on public.team_invitations for select
to authenticated
using (team_id = public.app_current_team() and public.app_is_team_admin());

create policy team_invitations_insert_admin
on public.team_invitations for insert
to authenticated
with check (team_id = public.app_current_team() and public.app_is_team_admin());

create policy team_invitations_update_admin
on public.team_invitations for update
to authenticated
using (team_id = public.app_current_team() and public.app_is_team_admin())
with check (team_id = public.app_current_team() and public.app_is_team_admin());

create policy team_invitations_delete_admin
on public.team_invitations for delete
to authenticated
using (team_id = public.app_current_team() and public.app_is_team_admin());

-- agents --------------------------------------------------------------------
-- Any member of the active team can see agents. Writes restricted to admins.
create policy agents_select_member
on public.agents for select
to authenticated
using (
  team_id = public.app_current_team()
  and exists (
    select 1 from public.team_members m
    where m.team_id = agents.team_id and m.user_id = auth.uid()
  )
);

create policy agents_insert_admin
on public.agents for insert
to authenticated
with check (team_id = public.app_current_team() and public.app_is_team_admin());

create policy agents_update_admin
on public.agents for update
to authenticated
using (team_id = public.app_current_team() and public.app_is_team_admin())
with check (team_id = public.app_current_team() and public.app_is_team_admin());

create policy agents_delete_admin
on public.agents for delete
to authenticated
using (team_id = public.app_current_team() and public.app_is_team_admin());
