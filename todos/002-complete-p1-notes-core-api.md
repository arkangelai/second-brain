---
status: complete
priority: p1
issue_id: "002"
tags: [backend, notes, api, policy, supabase]
dependencies: []
---

# Notes Core API

## Problem Statement

Issue #79 requires a complete notes lifecycle backend: schema with revisions and RLS, a write-policy engine, and CRUD/append/link/archive endpoints so authorized humans and agents can manage notes with an audit trail.

## Findings

- Existing tenancy uses `app.team_id` through `withTeamContext`.
- Existing principal resolution returns either human principals or agent principals with structured scopes.
- The migration sequence already has `0002_*`, so the notes migration must use the next available migration number while preserving the requested schema intent.
- Shared contracts currently contain only lightweight note metadata and need API response/request schemas.

## Proposed Solutions

1. Add a direct SQL-backed notes service and Next route handlers.
   - Pros: Matches existing raw Postgres team context, supports optimistic locking, revisions, and transactional appends.
   - Cons: More SQL to maintain.
2. Use Supabase client route handlers only.
   - Pros: Less handwritten SQL.
   - Cons: Harder to guarantee transaction-local `app.team_id`, atomic appends, and optimistic update details.

## Recommended Action

Implement option 1. Add a new notes migration, shared Zod contracts, policy helpers, SQL-backed notes repository/service code, route handlers, and focused tests for policy/markdown/service behavior.

## Acceptance Criteria

- [x] Notes schema includes `notes`, `note_revisions`, `moc_appends`, `note_links`, `notes_with_meta`, triggers, and RLS scoped by `app.team_id`.
- [x] Policy engine supports human/agent write decisions, locked paths, MOC append hints, frontmatter validation, and delete denial.
- [x] Shared notes API request/response shapes are exported as Zod schemas.
- [x] Read endpoints return notes, links, last revisions, archive behavior, revision pagination, full-body admin gating, and ETag.
- [x] Write endpoints implement create, optimistic patch, append, link, archive, and restore behavior with revisions.
- [x] Tests cover policy decisions and core note operations/helpers.
- [x] Quality checks pass or blockers are documented.

## Work Log

### 2026-05-14 - Implementation Start

**By:** Codex

**Actions:**
- Read GitHub issue #79 and existing auth/db/migration patterns.
- Confirmed branch `zeajose/newFeat_issue-79-ce-work` has no implementation diff yet.

**Learnings:**
- The repository uses Bun workspaces, Next route handlers, raw `pg` transactions for team-scoped backend work, and structured agent scopes in `@second-brain/shared`.

### 2026-05-14 - Implementation Complete

**By:** Codex

**Actions:**
- Added `supabase/migrations/0011_notes_core.sql` with notes, revisions, links, MOC appends, triggers, `notes_with_meta`, `pg_trgm`, and RLS.
- Added shared notes API Zod schemas in `packages/shared/src/api/notes.ts`.
- Added the notes write-policy engine in `apps/web/src/lib/policy/index.ts`.
- Added SQL-backed note service and HTTP helpers in `apps/web/src/lib/notes/`.
- Added route handlers for create, read, revisions, patch, append, links, archive, and restore.
- Added Bun tests for policy and markdown/link helpers.
- Ran `bun run typecheck`, `bun run test`, and `bun run lint`.

**Learnings:**
- Shared package schemas use Zod v3 while the web app has Zod v4 installed directly, so route parsing uses a small structural `safeParse` interface instead of tying helpers to one Zod version.
- `bun run lint` passes with existing CLI warnings unrelated to this work.
