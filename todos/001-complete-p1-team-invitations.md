---
status: complete
priority: p1
issue_id: "001"
tags: [nextjs, auth, supabase, email]
dependencies: []
---

# Team Invitation Flow

## Problem Statement

Issue #23 requires owners/admins to invite human team members by email. The current app has the database tables but no web auth helpers, invitation APIs, email integration, or public acceptance flow.

## Findings

- The codebase has Supabase tables and RLS policies for `team_invitations`, but the Next.js app is still a minimal scaffold.
- Issue #23 is nominally blocked by #21; this implementation should add only the prerequisite auth/client pieces needed for invites.
- `RESEND_API_KEY` must be optional in development so invite creation can console-print links.

## Proposed Solutions

- Add Supabase SSR/server helpers plus invitation-specific admin endpoints and pages.
- Add a database RPC for token acceptance so public invite links can be validated safely without exposing token hashes through RLS.
- Add Resend email wrapper with console fallback.

## Recommended Action

Implement the invitation flow in the web app, keep auth primitives narrow, and verify with typecheck/lint/build where possible.

## Acceptance Criteria

- [x] Sending an invite uses Resend when configured and logs the link when `RESEND_API_KEY` is absent.
- [x] Pending invites can be listed by owners/admins for the current team.
- [x] Pending invites can be cancelled by owners/admins.
- [x] Invite links drive unauthenticated recipients through a magic-link sign-in flow.
- [x] Invite acceptance validates expiry and single use, joins the user to the team, and marks the invite accepted.
- [x] Re-inviting the same pending email regenerates the token and extends expiry.
- [x] Expired and already-used tokens return 410 from the API.

## Work Log

### 2026-05-12 - Initial Implementation

**By:** Codex

**Actions:**
- Loaded `/ce:work`, `file-todos`, `next-best-practices`, and `frontend-design` guidance.
- Confirmed issue #23 is open and current branch starts clean at `origin/initial-setup`.
- Installed `@supabase/ssr`, `@supabase/supabase-js`, `resend`, `@react-email/components`, and `zod` in `apps/web`.
- Added Supabase server/admin clients, invitation admin role checks, token helpers, email client/template, invitation APIs, auth callback, login page, invite page, protected team page, and proxy auth gate.
- Added `0005_accept_team_invitations.sql` with pending-invite uniqueness and atomic acceptance RPC.
- Ran `SKIP_ENV_VALIDATION=1 bun run --filter='./apps/web' typecheck`: pass.
- Ran `SKIP_ENV_VALIDATION=1 bun run --filter='./apps/web' build`: pass.
- Ran `SKIP_ENV_VALIDATION=1 bun run test`: pass after updating the env test for optional Resend dev fallback.
- Ran `SKIP_ENV_VALIDATION=1 bun run lint`: pass with 9 pre-existing warnings in unrelated CLI files.
- Attempted `supabase db lint --local --fail-on error`: blocked because local Postgres was not running.
- Attempted `supabase start`: blocked because Docker daemon is not running.
- Started Next dev server on `http://localhost:3001` because port 3000 was already in use; smoke-tested `/login` with HTTP 200.

**Learnings:**
- The base schema already has `team_invitations`, but app-level Supabase auth/client plumbing is absent because #21 is still open.
- Runtime verification of invite acceptance needs a running Supabase stack and valid `apps/web/.env.local` values.

### 2026-05-13 - Review Follow-up

**By:** Codex

**Actions:**
- Addressed code review finding where accepting an invite to a non-default team could redirect to `/admin/team` and show the user's previous default team.
- Updated invite acceptance redirect to include the accepted `team_id`.
- Updated `/admin/team` to prefer a requested `team` query param when it matches a human membership for the signed-in user, then fall back to default team and earliest membership.
- Updated invitation acceptance RPC to set `user_profiles.default_team_id` to the accepted team.
- Guarded pending reinvite updates with `accepted_at is null` so a concurrently accepted invite cannot be rewritten and emailed as a false success.
- Ran `SKIP_ENV_VALIDATION=1 bun run --filter='./apps/web' typecheck`: pass.
- Ran `SKIP_ENV_VALIDATION=1 bun run test`: pass.
- Ran `SKIP_ENV_VALIDATION=1 bun run lint`: pass with 9 pre-existing warnings in unrelated CLI files.
- Ran `SKIP_ENV_VALIDATION=1 bun run --filter='./apps/web' build`: pass.
