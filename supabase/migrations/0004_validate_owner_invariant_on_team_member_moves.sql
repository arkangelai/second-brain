-- 0004_validate_owner_invariant_on_team_member_moves.sql
-- Fixes enforce_team_has_owner() so moving an owner membership between teams
-- validates both the source team and destination team at commit time.

create or replace function public.enforce_team_has_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_team uuid := old.team_id;
  new_team uuid := case when tg_op = 'UPDATE' then new.team_id else null end;
begin
  if old_team is not null
     and exists (select 1 from public.teams where id = old_team) then
    perform public.assert_team_has_owner(old_team);
  end if;

  if new_team is not null
     and new_team is distinct from old_team
     and exists (select 1 from public.teams where id = new_team) then
    perform public.assert_team_has_owner(new_team);
  end if;

  return null;
end;
$$;

revoke execute on function public.enforce_team_has_owner() from public;
