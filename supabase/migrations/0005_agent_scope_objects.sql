-- Agent scopes are structured JSON objects with read/write path rules,
-- allowed operations, ingestion flags, and write limits. Earlier bootstrap
-- migrations used arrays for seed-era placeholders; normalize those rows and
-- enforce the object shape expected by the shared Zod contract.

alter table public.team_members
  drop constraint if exists team_members_scopes_array_check;

alter table public.team_members
  add column if not exists description text;

alter table public.team_member_api_keys
  drop constraint if exists team_member_api_keys_scopes_check;

update public.team_members
   set scopes = case
     when jsonb_typeof(scopes) = 'object' then scopes
     when scopes ? 'ingest' then
       '{
         "read_paths": ["**/*"],
         "write_paths": ["01_thinking/notes/**", "02_reference/sources/**", "03_creating/drafts/**", "00_inbox/**"],
         "append_paths": ["01_thinking/**/*.md"],
         "ops": ["search", "get", "create", "append", "link", "ingest"],
         "ingestion": {"urls": true, "files": true},
         "max_writes_per_hour": 500
       }'::jsonb
     when scopes ? 'write' then
       '{
         "read_paths": ["**/*"],
         "write_paths": ["01_thinking/notes/**", "02_reference/sources/**", "03_creating/drafts/**", "00_inbox/**"],
         "append_paths": ["01_thinking/**/*.md"],
         "ops": ["search", "get", "create", "append", "link"],
         "ingestion": {"urls": false, "files": false},
         "max_writes_per_hour": 500
       }'::jsonb
     else
       '{
         "read_paths": ["**/*"],
         "write_paths": [],
         "append_paths": [],
         "ops": ["search", "get"],
         "ingestion": {"urls": false, "files": false},
         "max_writes_per_hour": 0
       }'::jsonb
   end;

update public.team_member_api_keys
   set scopes = case
     when jsonb_typeof(scopes) = 'object' then scopes
     when scopes ? 'ingest' then
       '{
         "read_paths": ["**/*"],
         "write_paths": ["01_thinking/notes/**", "02_reference/sources/**", "03_creating/drafts/**", "00_inbox/**"],
         "append_paths": ["01_thinking/**/*.md"],
         "ops": ["search", "get", "create", "append", "link", "ingest"],
         "ingestion": {"urls": true, "files": true},
         "max_writes_per_hour": 500
       }'::jsonb
     when scopes ? 'write' then
       '{
         "read_paths": ["**/*"],
         "write_paths": ["01_thinking/notes/**", "02_reference/sources/**", "03_creating/drafts/**", "00_inbox/**"],
         "append_paths": ["01_thinking/**/*.md"],
         "ops": ["search", "get", "create", "append", "link"],
         "ingestion": {"urls": false, "files": false},
         "max_writes_per_hour": 500
       }'::jsonb
     else
       '{
         "read_paths": ["**/*"],
         "write_paths": [],
         "append_paths": [],
         "ops": ["search", "get"],
         "ingestion": {"urls": false, "files": false},
         "max_writes_per_hour": 0
       }'::jsonb
   end;

alter table public.team_members
  add constraint team_members_scopes_object_check
  check (jsonb_typeof(scopes) = 'object');

alter table public.team_member_api_keys
  add constraint team_member_api_keys_scopes_object_check
  check (jsonb_typeof(scopes) = 'object');

create unique index if not exists team_members_agent_display_name_unique
  on public.team_members (team_id, lower(display_name))
  where member_type = 'agent';

create or replace function public.admin_create_agent_member(
  p_team_id uuid,
  p_member_id uuid,
  p_name text,
  p_description text,
  p_scopes jsonb,
  p_created_by_user_id uuid,
  p_key_name text,
  p_key_prefix text,
  p_key_hash text
)
returns table (
  member_id uuid,
  display_name text,
  description text,
  scopes jsonb,
  created_by_user_id uuid,
  last_seen_at timestamptz,
  active boolean,
  revoked_at timestamptz,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.team_members (
    team_id,
    member_id,
    member_type,
    user_id,
    role,
    invited_by,
    display_name,
    description,
    scopes,
    created_by_user_id,
    active
  ) values (
    p_team_id,
    p_member_id,
    'agent',
    null,
    'member',
    p_created_by_user_id,
    p_name,
    p_description,
    p_scopes,
    p_created_by_user_id,
    true
  );

  insert into public.team_member_api_keys (
    team_id,
    member_id,
    name,
    key_prefix,
    key_hash,
    scopes,
    created_by_user_id
  ) values (
    p_team_id,
    p_member_id,
    p_key_name,
    p_key_prefix,
    p_key_hash,
    p_scopes,
    p_created_by_user_id
  );

  return query
  select
    tm.member_id,
    tm.display_name,
    tm.description,
    tm.scopes,
    tm.created_by_user_id,
    tm.last_seen_at,
    tm.active,
    tm.revoked_at,
    tm.joined_at
  from public.team_members tm
  where tm.team_id = p_team_id
    and tm.member_id = p_member_id
    and tm.member_type = 'agent';
end;
$$;

create or replace function public.admin_revoke_agent_member(
  p_team_id uuid,
  p_member_id uuid,
  p_revoked_at timestamptz
)
returns table (
  member_id uuid,
  display_name text,
  description text,
  scopes jsonb,
  created_by_user_id uuid,
  last_seen_at timestamptz,
  active boolean,
  revoked_at timestamptz,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.team_members tm
    where tm.team_id = p_team_id
      and tm.member_id = p_member_id
      and tm.member_type = 'agent'
  ) then
    return;
  end if;

  update public.team_members tm
     set active = false,
         revoked_at = p_revoked_at
   where tm.team_id = p_team_id
     and tm.member_id = p_member_id
     and tm.member_type = 'agent';

  update public.team_member_api_keys api_key
     set revoked_at = p_revoked_at
   where api_key.team_id = p_team_id
     and api_key.member_id = p_member_id
     and api_key.revoked_at is null;

  return query
  select
    tm.member_id,
    tm.display_name,
    tm.description,
    tm.scopes,
    tm.created_by_user_id,
    tm.last_seen_at,
    tm.active,
    tm.revoked_at,
    tm.joined_at
  from public.team_members tm
  where tm.team_id = p_team_id
    and tm.member_id = p_member_id
    and tm.member_type = 'agent';
end;
$$;

revoke all on function public.admin_create_agent_member(
  uuid,
  uuid,
  text,
  text,
  jsonb,
  uuid,
  text,
  text,
  text
) from public;
revoke all on function public.admin_revoke_agent_member(
  uuid,
  uuid,
  timestamptz
) from public;

grant execute on function public.admin_create_agent_member(
  uuid,
  uuid,
  text,
  text,
  jsonb,
  uuid,
  text,
  text,
  text
) to service_role;
grant execute on function public.admin_revoke_agent_member(
  uuid,
  uuid,
  timestamptz
) to service_role;
