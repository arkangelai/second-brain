-- 0002_team_ownership_invariants.sql
-- Forward-only migration that addresses two correctness issues in the
-- initial multi-tenant schema:
--
--   * P1: teams.owner_user_id could drift from team_members.role='owner'
--     because nothing kept them in sync. The denormalized column is
--     dropped entirely; team_members is the single source of truth for
--     ownership.
--
--   * P2: prevent_last_owner_removal() ran as a per-row BEFORE trigger
--     and acquired pg_advisory_xact_lock() while already holding the
--     team_members row lock taken by the statement that fired it. Under
--     concurrency, a transaction that touches multiple owner rows could
--     hold the advisory lock and then block on another row lock, while
--     a concurrent transaction held that row lock and blocked on the
--     advisory lock — deadlock. We replace it with a DEFERRABLE
--     INITIALLY DEFERRED constraint trigger that fires at COMMIT time,
--     when no further row locks will be requested.

-- ---------------------------------------------------------------------------
-- P1: drop teams.owner_user_id and rewire dependencies
-- ---------------------------------------------------------------------------

drop policy if exists teams_insert_self_owner on public.teams;

drop index if exists public.teams_owner_user_id_idx;

alter table public.teams drop column if exists owner_user_id;

-- Any authenticated user can create a team; handle_new_team records
-- the caller as the owner in team_members.
create policy teams_insert_authenticated
on public.teams for insert
to authenticated
with check (auth.uid() is not null);

-- Rewire handle_new_team to use auth.uid() instead of the now-gone
-- owner_user_id column. For inserts with no auth context (seeds /
-- service_role / superuser) the trigger no-ops so the caller can
-- populate team_members explicitly.
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
  insert into public.team_members (team_id, user_id, role, invited_by)
  values (new.id, uid, 'owner', uid)
  on conflict (team_id, user_id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- P2: replace the BEFORE row trigger with a DEFERRED constraint trigger
-- ---------------------------------------------------------------------------

drop trigger if exists team_members_protect_last_owner on public.team_members;
drop function if exists public.prevent_last_owner_removal();

-- Refuse to commit a transaction that would leave any team with zero
-- owner-membership rows, so the owner-only RLS policies
-- (teams_update_owner / teams_delete_owner) can never become
-- permanently inaccessible. The same invariant is also checked after
-- INSERT on teams, which covers service-role / superuser creation paths
-- where handle_new_team() no-ops because auth.uid() is NULL.
--
-- Implemented as DEFERRABLE INITIALLY DEFERRED so:
--
--   1. Race-safety. A plain count(*) inside a per-row BEFORE trigger
--      is not enough — two transactions could each demote a different
--      owner row and both observe remaining_owners > 0. We serialize
--      per team with a transaction-scoped advisory lock keyed on
--      team_id.
--
--   2. Deadlock-safety. Deferred triggers fire after every row
--      operation in the transaction is complete, so the function
--      never acquires the advisory lock (or any other) while still
--      requesting row locks on team_members. That eliminates the
--        Tx1: holds row A, holds advisory, waits on row B
--        Tx2: holds row B, holds advisory, waits on row A
--      pattern that a per-row trigger would be vulnerable to whenever
--      a single statement (or transaction) touches multiple owner
--      rows. The advisory lock also lives in a separate lock space
--      from row locks, so it cannot interleave with the FK cascade
--      path used by DELETE FROM teams.
--
-- Service-role creation case: callers without auth.uid() may insert a
-- team and its explicit owner membership in the same transaction. The
-- teams-level constraint trigger is deferred, so that valid sequence can
-- commit while an ownerless team insert cannot.
--
-- Cascade case: when a team is deleted, the FK cascade removes its
-- team_members rows and the deferred trigger still fires for each of
-- them. We detect this by checking that the team row no longer exists
-- (the current transaction has already deleted it) and skip — the
-- invariant does not apply to a team that no longer exists.
--
-- RLS case: invariant checks must run as SECURITY DEFINER functions.
-- Otherwise RLS can make an existing team look absent after the final
-- visible owner membership row is removed, causing a false cascade skip.
create or replace function public.assert_team_has_owner(team uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_count int;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('team_members_owner_lock:' || team::text, 0)
  );

  select count(*) into owner_count
  from public.team_members
  where team_id = team and role = 'owner';

  if owner_count = 0 then
    raise exception 'team % must retain at least one owner', team
      using errcode = 'check_violation';
  end if;
end;
$$;

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

create or replace function public.enforce_new_team_has_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.teams where id = new.id) then
    return null;
  end if;

  perform public.assert_team_has_owner(new.id);

  return null;
end;
$$;

create constraint trigger teams_enforce_owner_invariant
after insert on public.teams
deferrable initially deferred
for each row execute function public.enforce_new_team_has_owner();

create constraint trigger team_members_enforce_owner_invariant
after update or delete on public.team_members
deferrable initially deferred
for each row execute function public.enforce_team_has_owner();

revoke execute on function public.assert_team_has_owner(uuid) from public;
revoke execute on function public.enforce_team_has_owner() from public;
revoke execute on function public.enforce_new_team_has_owner() from public;
