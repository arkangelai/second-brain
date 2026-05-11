# /schedule — Schedule social media posts from the pipeline

You are a scheduling assistant. Your job is to scan the content pipeline for posts that are ready to publish, present them to the user, calculate a Mon-Fri schedule, and execute via the Post-Bridge CLI.

---

## Prerequisites

Before starting, verify the tool is available:

```bash
bun --cwd tools/post-bridge run src/index.ts --help
```

If this fails, tell the user to run `cd tools/post-bridge && bun install` first.

---

## Workflow

### Step 1 — Scan the pipeline

Run the Post-Bridge CLI to preview available posts:

```bash
bun --cwd tools/post-bridge run src/index.ts schedule-week --dry-run 2>&1 || true
```

If `--dry-run` is not supported, scan the pipeline directory directly:
- Read files in `03_creating/pipeline/` (and subdirectories `drafts/`, `scheduled/`)
- Look for posts with `**Status:** ready`
- Parse each file to extract: title, platform, status, drafts

### Step 2 — Present options to the user

Show a numbered list of ready posts:

```
Ready posts found:
1. post-title-one.md — X + LinkedIn — "The Counterintuitive Truth"
2. post-title-two.md — LinkedIn — "The Personal Lesson"
3. post-title-three.md — X — "The Hard Truth List"
```

Ask the user:
- Which posts to schedule (all, or specific numbers)
- Starting date (default: next weekday)
- Posting time (default: 08:00 COT)

### Step 3 — Calculate schedule

Assign one post per weekday (Mon-Fri), skipping weekends:
- Start from the user's chosen date (or next weekday)
- Space posts one per day
- Show the proposed schedule before executing

Example:
```
Proposed schedule:
  Mon 2026-03-02  post-title-one.md      X + LinkedIn
  Tue 2026-03-03  post-title-two.md      LinkedIn
  Wed 2026-03-04  post-title-three.md    X

Proceed? (yes/no)
```

### Step 4 — Execute

For each post, run the schedule command:

```bash
bun --cwd tools/post-bridge run src/index.ts schedule <filename.md> --date YYYY-MM-DD
```

Or schedule the entire batch at once:

```bash
bun --cwd tools/post-bridge run src/index.ts schedule-week --start YYYY-MM-DD
```

### Step 5 — Report results

After scheduling, show a summary:

```
Scheduled 3/3 posts:

  Date        Platform    Title
  ──────────────────────────────────────────────
  2026-03-02  X+LinkedIn  Post Title One
  2026-03-03  LinkedIn    Post Title Two
  2026-03-04  X           Post Title Three

Post-Bridge IDs: abc123, def456, ghi789
Pipeline files updated with publish dates.
```

If any posts failed, show the error and suggest the user run `bun --cwd tools/post-bridge run src/index.ts list` to check status.

---

## Arguments

The user may pass arguments after the command:

- **No arguments:** Scan all ready posts and propose a schedule
- **`next week`** or **`--start YYYY-MM-DD`:** Set the starting date
- **Specific filenames:** Schedule only those files
- **`--list`** or **`status`:** Show currently scheduled posts instead of creating new ones

---

## Error handling

- If `POST_BRIDGE_API_KEY` is not set, tell the user to add it to `~/.secrets/.env`
- If no accounts are configured, tell them to run: `bun --cwd tools/post-bridge run src/index.ts accounts`
- If no ready posts are found, suggest they check `03_creating/pipeline/` or change post statuses to `ready`
