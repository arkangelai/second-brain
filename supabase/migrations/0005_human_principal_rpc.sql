-- 0005_human_principal_rpc.sql
-- Resolve the signed-in human principal through Supabase Auth and keep
-- transaction-scoped team context inside narrow RPC functions.

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
    where team_id = team
      and user_id = uid
      and member_type = 'human'
      and active
      and revoked_at is null
  ) then
    raise exception 'app_set_team: user % is not an active member of team %', uid, team;
  end if;

  perform set_config('app.team_id', team::text, true);
  return team;
end;
$$;

create or replace function public.app_resolve_human_principal(requested_team uuid default null)
returns table (
  id uuid,
  team_id uuid,
  role text,
  team_slug text,
  team_name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  resolved_team uuid;
begin
  if uid is null then
    return;
  end if;

  if requested_team is not null then
    resolved_team := requested_team;
  else
    select user_profiles.default_team_id
      into resolved_team
      from public.user_profiles
      join public.team_members
        on team_members.team_id = user_profiles.default_team_id
       and team_members.user_id = uid
       and team_members.member_type = 'human'
       and team_members.active
       and team_members.revoked_at is null
     where user_profiles.user_id = uid;

    if resolved_team is null then
      select team_members.team_id
        into resolved_team
        from public.team_members
       where team_members.user_id = uid
         and team_members.member_type = 'human'
         and team_members.active
         and team_members.revoked_at is null
       order by team_members.joined_at asc
       limit 1;
    end if;
  end if;

  if resolved_team is null then
    return;
  end if;

  perform public.app_set_team(resolved_team);

  return query
    select
      uid as id,
      team_members.team_id,
      team_members.role,
      teams.slug::text as team_slug,
      teams.name as team_name
    from public.team_members
    join public.teams on teams.id = team_members.team_id
    where team_members.team_id = resolved_team
      and team_members.user_id = uid
      and team_members.member_type = 'human'
      and team_members.active
      and team_members.revoked_at is null
    limit 1;
end;
$$;

revoke all on function public.app_resolve_human_principal(uuid) from public;
revoke all on function public.app_set_team(uuid) from public;
grant execute on function public.app_set_team(uuid) to authenticated, service_role;
grant execute on function public.app_resolve_human_principal(uuid) to authenticated;

create or replace function public.app_team_member_json(
  member public.team_members,
  current_user uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'userId', (member).user_id,
    'name', coalesce(nullif(user_profiles.full_name, ''), (member).display_name, 'Unknown member'),
    'email', coalesce(auth_users.email, 'Unknown email'),
    'avatarUrl', user_profiles.avatar_url,
    'role', (member).role,
    'joinedAt', (member).joined_at,
    'isCurrentUser', (member).user_id = current_user
  )
  from (select 1) seed
  left join public.user_profiles on user_profiles.user_id = (member).user_id
  left join auth.users auth_users on auth_users.id = (member).user_id
$$;

create or replace function public.app_invitation_json(invitation public.team_invitations)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', (invitation).id,
    'email', (invitation).email::text,
    'role', (invitation).role,
    'invitedAt', (invitation).created_at,
    'expiresAt', (invitation).expires_at
  )
$$;

create or replace function public.app_team_admin_page(requested_team uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  principal record;
  team_json jsonb;
  members_json jsonb;
  invitations_json jsonb;
begin
  select *
    into principal
    from public.app_resolve_human_principal(requested_team)
    limit 1;

  if not found then
    raise exception 'Authentication required.';
  end if;

  select jsonb_build_object(
    'id', teams.id,
    'name', teams.name,
    'slug', teams.slug::text,
    'createdAt', teams.created_at
  )
    into team_json
    from public.teams
   where teams.id = principal.team_id;

  select coalesce(
    jsonb_agg(public.app_team_member_json(team_members, principal.id) order by team_members.joined_at),
    '[]'::jsonb
  )
    into members_json
    from public.team_members
   where team_members.team_id = principal.team_id
     and team_members.member_type = 'human'
     and team_members.active
     and team_members.revoked_at is null;

  select coalesce(
    jsonb_agg(public.app_invitation_json(team_invitations) order by team_invitations.created_at desc),
    '[]'::jsonb
  )
    into invitations_json
    from public.team_invitations
   where team_invitations.team_id = principal.team_id
     and team_invitations.accepted_at is null;

  return jsonb_build_object(
    'team', team_json,
    'currentUser', jsonb_build_object(
      'id', principal.id,
      'role', principal.role
    ),
    'members', members_json,
    'invitations', invitations_json,
    'permissions', jsonb_build_object(
      'canRenameTeam', principal.role = 'owner',
      'canManageMembers', principal.role = 'owner',
      'canManageInvitations', principal.role in ('owner', 'admin')
    )
  );
end;
$$;

create or replace function public.app_rename_team(
  requested_team uuid default null,
  new_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  principal record;
  renamed public.teams;
begin
  select *
    into principal
    from public.app_resolve_human_principal(requested_team)
    limit 1;

  if not found then
    raise exception 'Authentication required.';
  end if;
  if principal.role <> 'owner' then
    raise exception 'Only owners can perform this action.';
  end if;

  update public.teams
     set name = new_name
   where teams.id = principal.team_id
   returning * into renamed;

  return jsonb_build_object(
    'id', renamed.id,
    'name', renamed.name,
    'slug', renamed.slug::text,
    'createdAt', renamed.created_at
  );
end;
$$;

create or replace function public.app_update_team_member_role(
  requested_team uuid default null,
  target_user uuid default null,
  next_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  principal record;
  target public.team_members;
  owner_count integer;
begin
  select *
    into principal
    from public.app_resolve_human_principal(requested_team)
    limit 1;

  if not found then
    raise exception 'Authentication required.';
  end if;
  if principal.role <> 'owner' then
    raise exception 'Only owners can perform this action.';
  end if;
  if next_role not in ('owner', 'admin', 'member') then
    raise exception 'Choose a valid role.';
  end if;

  select *
    into target
    from public.team_members
   where team_members.team_id = principal.team_id
     and team_members.user_id = target_user
     and team_members.member_type = 'human'
     and team_members.active
     and team_members.revoked_at is null;

  if not found then
    raise exception 'Member not found.';
  end if;

  select count(*)
    into owner_count
    from public.team_members
   where team_members.team_id = principal.team_id
     and team_members.member_type = 'human'
     and team_members.role = 'owner'
     and team_members.active
     and team_members.revoked_at is null;

  if target.role = 'owner' and next_role <> 'owner' and owner_count <= 1 then
    raise exception 'A team must keep at least one owner.';
  end if;

  update public.team_members
     set role = next_role
   where team_members.team_id = principal.team_id
     and team_members.user_id = target_user
     and team_members.member_type = 'human'
   returning * into target;

  return public.app_team_member_json(target, principal.id);
end;
$$;

create or replace function public.app_remove_team_member(
  requested_team uuid default null,
  target_user uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  principal record;
  target public.team_members;
  owner_count integer;
begin
  select *
    into principal
    from public.app_resolve_human_principal(requested_team)
    limit 1;

  if not found then
    raise exception 'Authentication required.';
  end if;
  if principal.role <> 'owner' then
    raise exception 'Only owners can perform this action.';
  end if;

  select *
    into target
    from public.team_members
   where team_members.team_id = principal.team_id
     and team_members.user_id = target_user
     and team_members.member_type = 'human'
     and team_members.active
     and team_members.revoked_at is null;

  if not found then
    raise exception 'Member not found.';
  end if;

  select count(*)
    into owner_count
    from public.team_members
   where team_members.team_id = principal.team_id
     and team_members.member_type = 'human'
     and team_members.role = 'owner'
     and team_members.active
     and team_members.revoked_at is null;

  if target.role = 'owner' and owner_count <= 1 then
    raise exception 'A team must keep at least one owner.';
  end if;

  delete from public.team_members
   where team_members.team_id = principal.team_id
     and team_members.user_id = target_user
     and team_members.member_type = 'human';
end;
$$;

create or replace function public.app_create_team_invitation(
  requested_team uuid default null,
  invite_email text default null,
  invite_role text default null,
  invite_token_hash text default null,
  invite_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  principal record;
  invitation public.team_invitations;
begin
  select *
    into principal
    from public.app_resolve_human_principal(requested_team)
    limit 1;

  if not found then
    raise exception 'Authentication required.';
  end if;
  if principal.role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can perform this action.';
  end if;
  if invite_role not in ('owner', 'admin', 'member') then
    raise exception 'Choose a valid role.';
  end if;

  delete from public.team_invitations
   where team_invitations.team_id = principal.team_id
     and team_invitations.email = invite_email::citext
     and team_invitations.accepted_at is null;

  insert into public.team_invitations (
    team_id,
    email,
    role,
    token_hash,
    expires_at,
    invited_by
  ) values (
    principal.team_id,
    invite_email,
    invite_role,
    invite_token_hash,
    invite_expires_at,
    principal.id
  )
  returning * into invitation;

  return public.app_invitation_json(invitation);
end;
$$;

create or replace function public.app_cancel_team_invitation(
  requested_team uuid default null,
  invitation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  principal record;
begin
  select *
    into principal
    from public.app_resolve_human_principal(requested_team)
    limit 1;

  if not found then
    raise exception 'Authentication required.';
  end if;
  if principal.role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can perform this action.';
  end if;

  delete from public.team_invitations
   where team_invitations.team_id = principal.team_id
     and team_invitations.id = invitation_id
     and team_invitations.accepted_at is null;
end;
$$;

create or replace function public.app_regenerate_team_invitation(
  requested_team uuid default null,
  invitation_id uuid default null,
  invite_token_hash text default null,
  invite_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  principal record;
  invitation public.team_invitations;
begin
  select *
    into principal
    from public.app_resolve_human_principal(requested_team)
    limit 1;

  if not found then
    raise exception 'Authentication required.';
  end if;
  if principal.role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can perform this action.';
  end if;

  update public.team_invitations
     set token_hash = invite_token_hash,
         expires_at = invite_expires_at
   where team_invitations.team_id = principal.team_id
     and team_invitations.id = invitation_id
     and team_invitations.accepted_at is null
   returning * into invitation;

  if not found then
    raise exception 'Invitation not found.';
  end if;

  return public.app_invitation_json(invitation);
end;
$$;

revoke all on function public.app_team_member_json(public.team_members, uuid) from public;
revoke all on function public.app_invitation_json(public.team_invitations) from public;
revoke all on function public.app_team_admin_page(uuid) from public;
revoke all on function public.app_rename_team(uuid, text) from public;
revoke all on function public.app_update_team_member_role(uuid, uuid, text) from public;
revoke all on function public.app_remove_team_member(uuid, uuid) from public;
revoke all on function public.app_create_team_invitation(uuid, text, text, text, timestamptz) from public;
revoke all on function public.app_cancel_team_invitation(uuid, uuid) from public;
revoke all on function public.app_regenerate_team_invitation(uuid, uuid, text, timestamptz) from public;

grant execute on function public.app_team_admin_page(uuid) to authenticated;
grant execute on function public.app_rename_team(uuid, text) to authenticated;
grant execute on function public.app_update_team_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.app_remove_team_member(uuid, uuid) to authenticated;
grant execute on function public.app_create_team_invitation(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.app_cancel_team_invitation(uuid, uuid) to authenticated;
grant execute on function public.app_regenerate_team_invitation(uuid, uuid, text, timestamptz) to authenticated;
