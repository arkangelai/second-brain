# Agent CLI and API Guide

This guide is written for AI agents that receive a Second Brain agent API key.
It covers the human registration flow, how to store the key, the local
`second-brain` CLI commands, and the HTTP Notes API that accepts the agent key.

## 1. Human registration flow

1. Sign in to the web app as an owner or admin.
2. Open `/admin/agents`.
3. Enter the agent name and choose a scope template.
4. Click **Create agent**.
5. Copy the plaintext API key from the one-time reveal dialog.

The plaintext key is only shown once. If it is lost, revoke the agent and create
a new one.

## 2. Agent environment

Store secrets outside the repository and outside the vault. Use shell
environment variables:

```bash
export SECOND_BRAIN_API_BASE_URL="https://your-second-brain.example.com"
export SECOND_BRAIN_AGENT_TOKEN="paste_the_one_time_agent_key_here"
export SECOND_BRAIN_PATH="$HOME/Documents/Second_Brain"
```

Use the agent token only as an HTTP credential:

```bash
Authorization: Bearer $SECOND_BRAIN_AGENT_TOKEN
```

Never write the token into markdown notes, config files in the vault, commits,
logs, screenshots, or prompts that will be shared with another model.

## 3. Local CLI commands

The `second-brain` CLI operates on the local vault. It does not need the agent
API token for local file and QMD workflows.

```bash
second-brain status
second-brain search "query"
second-brain create note "title"
second-brain create post "title"
second-brain draft "topic" --agent codex
second-brain publish --dry-run
second-brain pull --dry-run
```

Vault path resolution:

1. `--vault <path>`
2. `SECOND_BRAIN_PATH`
3. `~/.config/second-brain/config.json`
4. `~/Documents/Second_Brain`

Before making changes, run:

```bash
second-brain status
second-brain search "the topic or file you need"
```

Use `create note` for durable knowledge and `create post` for draft pipeline
content. Prefer `--dry-run` for publish and pull commands until the human
confirms the integration is configured.

## 4. HTTP Notes API

The web Notes API accepts the agent token. All examples assume:

```bash
API="$SECOND_BRAIN_API_BASE_URL"
AUTH="Authorization: Bearer $SECOND_BRAIN_AGENT_TOKEN"
```

### List or search notes

```bash
curl -sS -H "$AUTH" "$API/api/notes?limit=20"
curl -sS -H "$AUTH" "$API/api/notes?q=pricing&folder=01_thinking/notes"
```

Response shape:

```json
{
  "notes": [
    {
      "slug": "pricing-notes",
      "folder": "01_thinking/notes",
      "title": "Pricing notes",
      "body": "...",
      "version": 3
    }
  ],
  "next_updated_before": null,
  "next_updated_before_id": null
}
```

For the next page, pass both returned cursor parts:
`updated_before=$next_updated_before&updated_before_id=$next_updated_before_id`.

### Read one note

```bash
curl -sS -H "$AUTH" "$API/api/notes/pricing-notes"
```

The response includes `note`, `links_in`, `links_out`, and `last_revisions`.
Keep the returned `note.version`; patch requests require it.

### Create a note

```bash
curl -sS -X POST "$API/api/notes" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "folder": "01_thinking/notes",
    "title": "Pricing notes",
    "body": "## Summary\n\n...",
    "frontmatter": {
      "tags": ["pricing"]
    }
  }'
```

### Patch a note

Use optimistic locking. First read the note, then send its current `version` as
`if_version`.

```bash
curl -sS -X PATCH "$API/api/notes/pricing-notes" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "if_version": 3,
    "body": "Updated markdown body"
  }'
```

If another actor updated the note first, the API returns `409` with the current
record. Read the current version and retry only if the change is still correct.

### Append to an allowed section

```bash
curl -sS -X POST "$API/api/notes/pricing-notes/append" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "section": "breadcrumbs",
    "text": "- Observed a related pricing pattern.",
    "wiki_links": ["packaging-strategy"]
  }'
```

Allowed built-in append sections are `breadcrumbs`, `open_questions`,
`key_notes`, and `sources`. Notes can allow extra sections through
`frontmatter.append_sections`.

### Link notes

```bash
curl -sS -X POST "$API/api/notes/pricing-notes/links" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "target_slug": "packaging-strategy",
    "context_phrase": "packaging"
  }'
```

### Revisions

```bash
curl -sS -H "$AUTH" "$API/api/notes/pricing-notes/revisions?limit=20"
```

Full revision bodies require an owner or admin human session and are not
available to normal agent keys.
For the next revisions page, pass both `before` and `before_id` from the
`next_before` and `next_before_id` response fields.

### Archive and restore

```bash
curl -sS -X POST "$API/api/archive/pricing-notes" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{ "reason": "Superseded by packaging-strategy" }'

curl -sS -X POST "$API/api/archive/pricing-notes/restore" \
  -H "$AUTH"
```

## 5. Scope expectations

The agent key is constrained by its scope template:

| Template | Expected use |
| --- | --- |
| Reader | Search and read only |
| Writer | Search, read, create, append, and link in the default writable paths |
| Researcher | Writer plus ingestion permissions |
| Custom | Human-defined operations and path globs |

The default writable paths are:

- `01_thinking/notes/**`
- `02_reference/sources/**`
- `03_creating/drafts/**`
- `00_inbox/**`

If the API returns `403`, do not try to bypass it. Tell the human which
operation and path were blocked so they can adjust the agent scope.

## 6. Failure handling

| Status | Meaning | Agent action |
| --- | --- | --- |
| 401 | Missing, malformed, expired, revoked, or invalid key | Stop and ask the human for a fresh key |
| 403 | Authenticated but not allowed by role or scope | Stop and report the blocked operation |
| 404 | Note or team resource not found | Re-check slug, folder, or team |
| 409 | Optimistic locking conflict | Re-read the note and retry only if appropriate |
| 410 | Note is archived | Ask before restoring or editing |

## 7. Agent operating rules

1. Read before writing.
2. Preserve frontmatter unless a task explicitly changes it.
3. Use optimistic locking for edits.
4. Prefer append for breadcrumbs, sources, and open questions.
5. Do not archive unless the human explicitly asks.
6. Keep secrets in environment variables only.
