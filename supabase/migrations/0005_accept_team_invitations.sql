-- 0005_accept_team_invitations.sql
-- Atomic invitation acceptance for public magic-link invite URLs.

create unique index if not exists team_invitations_one_pending_per_email
  on public.team_invitations (team_id, email)
  where accepted_at is null;

create or replace function public.accept_team_invitation(
  invite_token_hash text,
  accepting_user uuid
)
returns table(status text, team_id uuid, role text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invitation public.team_invitations%rowtype;
  user_email text;
begin
  select *
    into invitation
    from public.team_invitations ti
   where ti.token_hash = invite_token_hash
   for update;

  if not found
     or invitation.accepted_at is not null
     or invitation.expires_at <= now() then
    return query select 'gone'::text, null::uuid, null::text;
    return;
  end if;

  select email
    into user_email
    from auth.users
   where id = accepting_user;

  if user_email is null
     or lower(user_email) <> lower(invitation.email::text) then
    return query select 'email_mismatch'::text, null::uuid, null::text;
    return;
  end if;

  insert into public.user_profiles (user_id)
  values (accepting_user)
  on conflict (user_id) do nothing;

  insert into public.team_members (
    team_id,
    member_id,
    member_type,
    user_id,
    role,
    invited_by
  ) values (
    invitation.team_id,
    accepting_user,
    'human',
    accepting_user,
    invitation.role,
    invitation.invited_by
  )
  on conflict (team_id, member_id) do nothing;

  update public.team_invitations
     set accepted_at = now(),
         accepted_by = accepting_user
   where id = invitation.id;

  return query select 'accepted'::text, invitation.team_id, invitation.role;
end;
$$;

revoke all on function public.accept_team_invitation(text, uuid) from public;
grant execute on function public.accept_team_invitation(text, uuid) to service_role;
