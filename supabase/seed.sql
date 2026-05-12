-- seed.sql
-- LOCAL DEVELOPMENT ONLY. Never run against a remote Supabase project.
-- Provides a known dev user, team, human membership, and agent membership so
-- the app and CLI can run end-to-end without manual setup after
-- `supabase db reset`.

-- Stable IDs make it easy to reference these rows from app/CLI code in dev.
-- dev user        : 00000000-0000-0000-0000-000000000001
-- dev team        : 00000000-0000-0000-0000-0000000000a1
-- dev agent       : 00000000-0000-0000-0000-0000000000c1

-- Insert a confirmed dev user directly into auth.users.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_super_admin
) values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'dev@second-brain.local',
  crypt('devpassword', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Dev User"}'::jsonb,
  now(),
  now(),
  false
)
on conflict (id) do nothing;

-- Matching identity row so password sign-in works in the local Studio.
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'sub', '00000000-0000-0000-0000-000000000001',
    'email', 'dev@second-brain.local',
    'email_verified', true
  ),
  'email',
  now(),
  now(),
  now()
)
on conflict do nothing;

insert into public.user_profiles (user_id, full_name)
values ('00000000-0000-0000-0000-000000000001', 'Dev User')
on conflict (user_id) do nothing;

-- Team. The teams_owner_membership trigger no-ops when auth.uid() is
-- NULL (as during seeding), so the team and explicit owner membership
-- are inserted in one statement. That satisfies the deferred
-- teams_enforce_owner_invariant trigger even when the seed runner
-- autocommits each statement.
with upsert_team as (
  insert into public.teams (id, slug, name, plan)
  values (
    '00000000-0000-0000-0000-0000000000a1',
    'dev',
    'Dev Team',
    'free'
  )
  on conflict (id) do nothing
  returning id
)
insert into public.team_members (
  team_id,
  member_id,
  member_type,
  user_id,
  role,
  invited_by
)
select
  coalesce((select id from upsert_team), '00000000-0000-0000-0000-0000000000a1'::uuid),
  '00000000-0000-0000-0000-000000000001',
  'human',
  '00000000-0000-0000-0000-000000000001',
  'owner',
  '00000000-0000-0000-0000-000000000001'
on conflict (team_id, member_id) do nothing;

update public.user_profiles
   set default_team_id = '00000000-0000-0000-0000-0000000000a1'
 where user_id = '00000000-0000-0000-0000-000000000001';

-- Dev agent. Agents are team_members with member_type='agent'. API keys live
-- in team_member_api_keys and are created only when a key is minted.
insert into public.team_members (
  team_id,
  member_id,
  member_type,
  user_id,
  role,
  invited_by,
  display_name,
  scopes,
  created_by_user_id,
  active
) values (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000c1',
  'agent',
  null,
  'member',
  '00000000-0000-0000-0000-000000000001',
  'dev-cli',
  '["read","write"]'::jsonb,
  '00000000-0000-0000-0000-000000000001',
  true
)
on conflict (team_id, member_id) do nothing;
