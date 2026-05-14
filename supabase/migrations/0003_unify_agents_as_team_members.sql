-- 0003_unify_agents_as_team_members.sql
-- Forward-only migration:
--
--   * Treat agents as first-class team_members instead of a separate
--     team-scoped resource table.
--   * Keep user_id for human Supabase Auth identities, but introduce
--     member_id + member_type so non-human members can share the same
--     team membership, role, RLS, and ownership invariants.
--   * Move API credentials into team_member_api_keys so both humans and
--     agents can have independently rotatable keys.

-- ---------------------------------------------------------------------------
-- Add unified member columns
-- ---------------------------------------------------------------------------

alter table public.team_members
  add column member_id uuid,
  add column member_type text not null default 'human',
  add column display_name text,
  add column scopes jsonb not null default '[]'::jsonb,
  add column created_by_user_id uuid references auth.users(id) on delete set null,
  add column last_seen_at timestamptz,
  add column active boolean not null default true,
  add column revoked_at timestamptz;

update public.team_members
   set member_id = user_id,
       member_type = 'human'
 where member_id is null;

alter table public.team_members
  alter column member_id set not null;

alter table public.team_members
  drop constraint team_members_pkey;

alter table public.team_members
  alter column user_id drop not null;

alter table public.team_members
  add constraint team_members_pkey primary key (team_id, member_id),
  add constraint team_members_member_type_check
    check (member_type in ('human', 'agent')),
  add constraint team_members_scopes_array_check
    check (jsonb_typeof(scopes) = 'array'),
  add constraint team_members_human_or_agent_identity_check
    check (
      (
        member_type = 'human'
        and user_id is not null
        and member_id = user_id
      )
      or (
        member_type = 'agent'
        and user_id is null
        and display_name is not null
        and role <> 'owner'
      )
    );

create index team_members_member_type_idx
  on public.team_members (member_type);

create index team_members_created_by_user_id_idx
  on public.team_members (created_by_user_id);

create index team_members_active_agent_idx
  on public.team_members (team_id, active)
  where member_type = 'agent';

-- ---------------------------------------------------------------------------
-- Rotatable API keys for any team member
-- ---------------------------------------------------------------------------

create table public.team_member_api_keys (
  id                  uuid primary key default gen_random_uuid(),
  team_id             uuid not null,
  member_id           uuid not null,
  name                text not null,
  key_prefix          text,
  key_hash            text not null,
  scopes              jsonb not null default '[]'::jsonb,
  created_by_user_id  uuid references auth.users(id) on delete set null,
  rotated_from_key_id uuid references public.team_member_api_keys(id) on delete set null,
  last_used_at        timestamptz,
  expires_at          timestamptz,
  revoked_at          timestamptz,
  created_at          timestamptz not null default now(),
  foreign key (team_id, member_id)
    references public.team_members (team_id, member_id)
    on delete cascade,
  check (jsonb_typeof(scopes) = 'array'),
  check (expires_at is null or expires_at > created_at),
  check (revoked_at is null or revoked_at >= created_at)
);

create index team_member_api_keys_member_idx
  on public.team_member_api_keys (team_id, member_id);

create index team_member_api_keys_created_by_user_id_idx
  on public.team_member_api_keys (created_by_user_id);

create unique index team_member_api_keys_active_prefix_unique
  on public.team_member_api_keys (key_prefix)
  where key_prefix is not null and revoked_at is null;

alter table public.team_member_api_keys enable row level security;

create policy team_member_api_keys_select_admin
on public.team_member_api_keys for select
to authenticated
using (team_id = public.app_current_team() and public.app_is_team_admin());

create policy team_member_api_keys_insert_admin
on public.team_member_api_keys for insert
to authenticated
with check (team_id = public.app_current_team() and public.app_is_team_admin());

create policy team_member_api_keys_update_admin
on public.team_member_api_keys for update
to authenticated
using (team_id = public.app_current_team() and public.app_is_team_admin())
with check (team_id = public.app_current_team() and public.app_is_team_admin());

create policy team_member_api_keys_delete_admin
on public.team_member_api_keys for delete
to authenticated
using (team_id = public.app_current_team() and public.app_is_team_admin());

-- ---------------------------------------------------------------------------
-- Migrate existing agents into team_members and team_member_api_keys
-- ---------------------------------------------------------------------------

insert into public.team_members (
  team_id,
  member_id,
  member_type,
  user_id,
  role,
  joined_at,
  invited_by,
  display_name,
  scopes,
  created_by_user_id,
  last_seen_at,
  active,
  revoked_at
)
select
  agents.team_id,
  agents.id,
  'agent',
  null,
  'member',
  agents.created_at,
  agents.created_by_user_id,
  agents.name,
  agents.scopes,
  agents.created_by_user_id,
  agents.last_seen_at,
  agents.active,
  agents.revoked_at
from public.agents
on conflict (team_id, member_id) do update
   set display_name = excluded.display_name,
       scopes = excluded.scopes,
       created_by_user_id = excluded.created_by_user_id,
       last_seen_at = excluded.last_seen_at,
       active = excluded.active,
       revoked_at = excluded.revoked_at;

insert into public.team_member_api_keys (
  team_id,
  member_id,
  name,
  key_hash,
  scopes,
  created_by_user_id,
  last_used_at,
  revoked_at,
  created_at
)
select
  agents.team_id,
  agents.id,
  agents.name || ' legacy key',
  agents.api_key_hash,
  agents.scopes,
  agents.created_by_user_id,
  agents.last_seen_at,
  agents.revoked_at,
  agents.created_at
from public.agents
where agents.api_key_hash is not null;

drop table public.agents;
