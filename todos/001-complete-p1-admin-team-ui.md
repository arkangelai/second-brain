---
status: complete
priority: p1
issue_id: "001"
tags: [nextjs, admin-ui, teams, supabase]
dependencies: []
---

# Admin Team UI

## Problem Statement

GitHub issue #25 asks for an `/admin/team` page where team owners and admins can manage team settings, members, pending invitations, and invitation creation.

## Findings

- The database schema already contains `teams`, `team_members`, `team_invitations`, `user_profiles`, and owner invariant triggers.
- The dependent auth, invitation email, and onboarding issues (#21, #23, #24) are still open in GitHub and are not implemented in this branch.
- The current web app has only a smoke-test page and one shadcn-style `Button` component.

## Proposed Solutions

- Build the admin team surface against the real schema, with a server-only context helper that can later be swapped to the full auth integration from #21.
- Add route handlers and server actions for the issue #25 mutation surface.
- Keep client code focused on forms, optimistic UI, and toast feedback; no client-side Supabase calls.

## Recommended Action

Implement the page, route handlers, server actions, and UI components in `apps/web`, using the existing seeded dev user as a local fallback until the auth dependency lands.

## Acceptance Criteria

- [x] `/admin/team` renders team settings, members, pending invitations, and invite form.
- [x] Owner can rename the team; admins and members cannot.
- [x] Owner can change member roles and remove members, with sole-owner guards.
- [x] Members do not see invite form or role controls.
- [x] Invite form validates email client-side and server-side.
- [x] Mobile layout remains usable and controls have accessible labels.
- [x] No client-side Supabase calls are introduced.

## Work Log

### 2026-05-12 - Implementation

**By:** Codex

**Actions:**
- Started issue #25 implementation from `zeajose/newfeat-issue-25-ce-work`.
- Confirmed dependent issues #21, #23, and #24 are still open and not present in this branch.
- Added server-side team admin data access, mutations, and route handlers.
- Added `/admin/team` server page with a client island for optimistic forms, dialogs, selects, tables, and Sonner toasts.
- Ran `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web build`, `bun run test`, and `bun run lint`.

**Learnings:**
- This branch needs a compatibility layer for team context because the full auth/onboarding stack is not yet merged.
- `bun run lint` passes with pre-existing CLI unused-variable warnings.
