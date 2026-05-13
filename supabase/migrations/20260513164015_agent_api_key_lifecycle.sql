-- 20260513164015_agent_api_key_lifecycle.sql
-- Agent API key lifecycle support: auth failure tracking, audit logs, and
-- JSON scope shapes compatible with object-based path/operation grants.

alter table public.team_members
  drop constraint if exists team_members_scopes_array_check,
  drop constraint if exists team_members_scopes_json_check,
  add constraint team_members_scopes_json_check
    check (jsonb_typeof(scopes) in ('array', 'object'));

alter table public.team_member_api_keys
  drop constraint if exists team_member_api_keys_scopes_check,
  drop constraint if exists team_member_api_keys_scopes_json_check,
  add constraint team_member_api_keys_scopes_json_check
    check (jsonb_typeof(scopes) in ('array', 'object'));

create table if not exists public.agent_auth_failures (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid references public.teams(id) on delete cascade,
  member_id       uuid,
  key_id          uuid references public.team_member_api_keys(id) on delete set null,
  key_prefix      text,
  team_slug       citext,
  failure_reason  text not null,
  request_ip      text,
  user_agent      text,
  created_at      timestamptz not null default now(),
  foreign key (team_id, member_id)
    references public.team_members (team_id, member_id)
    on delete set null
);

create index if not exists agent_auth_failures_key_window_idx
  on public.agent_auth_failures (key_id, created_at desc);

create index if not exists agent_auth_failures_created_at_idx
  on public.agent_auth_failures (created_at desc);

create table if not exists public.agent_logs (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references public.teams(id) on delete cascade,
  member_id      uuid,
  key_id         uuid references public.team_member_api_keys(id) on delete set null,
  actor_user_id  uuid references auth.users(id) on delete set null,
  event_type     text not null check (
    event_type in (
      'agent_key_created',
      'agent_key_revoked',
      'agent_key_locked'
    )
  ),
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists agent_logs_team_created_at_idx
  on public.agent_logs (team_id, created_at desc);

create index if not exists agent_logs_member_created_at_idx
  on public.agent_logs (team_id, member_id, created_at desc);

alter table public.agent_auth_failures enable row level security;
alter table public.agent_logs enable row level security;

drop policy if exists agent_auth_failures_select_admin on public.agent_auth_failures;
create policy agent_auth_failures_select_admin
on public.agent_auth_failures for select
to authenticated
using (team_id = public.app_current_team() and public.app_is_team_admin());

drop policy if exists agent_logs_select_admin on public.agent_logs;
create policy agent_logs_select_admin
on public.agent_logs for select
to authenticated
using (team_id = public.app_current_team() and public.app_is_team_admin());
