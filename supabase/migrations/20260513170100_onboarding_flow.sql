-- 20260513170100_onboarding_flow.sql
-- Transactional helpers for first-team onboarding and authenticated
-- acceptance of pending invitations.

-- After team_members gained member_id/member_type, team creation triggers must
-- populate the unified human membership columns.
create or replace function public.handle_new_team()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return new;
  end if;

  insert into public.team_members (
    team_id,
    member_id,
    member_type,
    user_id,
    role,
    invited_by
  )
  values (new.id, uid, 'human', uid, 'owner', uid)
  on conflict (team_id, member_id) do nothing;

  return new;
end;
$$;

create or replace function public.app_slug_base(raw_slug text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(
        both '-' from regexp_replace(
          lower(trim(coalesce(raw_slug, ''))),
          '[^a-z0-9]+',
          '-',
          'g'
        )
      ),
      ''
    ),
    'team'
  )
$$;

create or replace function public.app_create_team(team_name text, requested_slug text)
returns table (
  id uuid,
  slug citext,
  name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  cleaned_name text := nullif(trim(coalesce(team_name, '')), '');
  base_slug text;
  candidate_slug citext;
  suffix int := 1;
  created_team_id uuid;
begin
  if uid is null then
    raise exception 'app_create_team: no authenticated user'
      using errcode = '28000';
  end if;

  if cleaned_name is null then
    raise exception 'app_create_team: team name is required'
      using errcode = '22023';
  end if;

  -- First-run onboarding only: refuse if the caller already belongs to a team.
  if exists (
    select 1
      from public.team_members
     where user_id = uid
       and member_type = 'human'
       and active
       and revoked_at is null
  ) then
    raise exception 'app_create_team: user already belongs to a team'
      using errcode = '42501';
  end if;

  base_slug := public.app_slug_base(coalesce(requested_slug, cleaned_name));
  candidate_slug := base_slug::citext;

  loop
    begin
      insert into public.teams (slug, name)
      values (candidate_slug, cleaned_name)
      returning teams.id into created_team_id;

      exit;
    exception
      when unique_violation then
        suffix := suffix + 1;
        candidate_slug := (base_slug || '-' || suffix)::citext;
    end;
  end loop;

  insert into public.team_members (
    team_id,
    member_id,
    member_type,
    user_id,
    role,
    invited_by
  )
  values (created_team_id, uid, 'human', uid, 'owner', uid)
  on conflict (team_id, member_id) do update
    set role = 'owner',
        member_type = 'human',
        user_id = uid,
        active = true,
        revoked_at = null;

  insert into public.user_profiles (user_id, default_team_id)
  values (uid, created_team_id)
  on conflict (user_id) do update
    set default_team_id = excluded.default_team_id;

  return query
    select teams.id, teams.slug, teams.name
    from public.teams
    where teams.id = created_team_id;
end;
$$;

create or replace function public.app_accept_invitation(invitation uuid)
returns table (
  team_id uuid,
  team_slug citext,
  team_name text,
  role text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  user_email citext := nullif(auth.jwt() ->> 'email', '')::citext;
  pending_invitation public.team_invitations%rowtype;
begin
  if uid is null then
    raise exception 'app_accept_invitation: no authenticated user'
      using errcode = '28000';
  end if;

  if user_email is null then
    raise exception 'app_accept_invitation: authenticated user has no email'
      using errcode = '22023';
  end if;

  select *
    into pending_invitation
    from public.team_invitations
   where id = invitation
     and accepted_at is null
     and expires_at > now()
   for update;

  if not found then
    raise exception 'app_accept_invitation: invitation is expired, accepted, or missing'
      using errcode = '02000';
  end if;

  if pending_invitation.email <> user_email then
    raise exception 'app_accept_invitation: invitation is for a different email'
      using errcode = '42501';
  end if;

  insert into public.team_members (
    team_id,
    member_id,
    member_type,
    user_id,
    role,
    invited_by
  )
  values (
    pending_invitation.team_id,
    uid,
    'human',
    uid,
    pending_invitation.role,
    pending_invitation.invited_by
  )
  on conflict (team_id, member_id) do update
    set role = excluded.role,
        member_type = 'human',
        user_id = uid,
        invited_by = excluded.invited_by,
        joined_at = case
          when public.team_members.active then public.team_members.joined_at
          else now()
        end,
        active = true,
        revoked_at = null;

  update public.team_invitations
     set accepted_at = now(),
         accepted_by = uid
   where id = pending_invitation.id;

  insert into public.user_profiles (user_id, default_team_id)
  values (uid, pending_invitation.team_id)
  on conflict (user_id) do update
    set default_team_id = excluded.default_team_id;

  return query
    select teams.id, teams.slug, teams.name, pending_invitation.role
      from public.teams
     where teams.id = pending_invitation.team_id;
end;
$$;

revoke execute on function public.app_slug_base(text) from public;
revoke execute on function public.app_create_team(text, text) from public;
revoke execute on function public.app_accept_invitation(uuid) from public;

grant execute on function public.app_create_team(text, text) to authenticated;
grant execute on function public.app_accept_invitation(uuid) to authenticated;
