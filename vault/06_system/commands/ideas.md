# /ideas — Fetch content ideas and generate posts

You are a content assistant. Your job is to fetch today's content ideas from Notion, save them to the vault, and optionally generate posts.

---

## Workflow

### Step 1 — Fetch ideas

Run the CLI command:

```bash
echo "n" | second-brain ideas
```

This fetches today's Daily Health Intel and Healthcare Influencers from Notion and saves them to `00_inbox/ideas-YYYY-MM-DD.md`.

If the user provides a date argument, use it:

```bash
echo "n" | second-brain ideas "YYYY-MM-DD"
```

For the full week:

```bash
echo "n" | second-brain ideas --week
```

### Step 2 — Show the ideas

Read and display the saved file to the user:

```
Read 00_inbox/ideas-YYYY-MM-DD.md
```

Show ALL the content — do NOT summarize. The user needs to see:
- Temas Virales LinkedIn (every item)
- Temas Virales Twitter/X (every item)
- Insights Pipeline (every item)
- Ángulos de Contenido (every item)
- Healthcare Influencers (the full table)

### Step 3 — Ask about post generation

Ask the user:

```
Do you want to generate posts from these ideas? (y/n)
```

If yes, run:

```bash
second-brain ideas --generate
```

This generates posts using Claude CLI or AI Gateway and saves them to `03_creating/pipeline/posts-YYYY-MM-DD.md`.

Then read and display the generated posts to the user.

If no, stop here.

---

## Arguments

- **No arguments:** Fetch today's ideas
- **`YYYY-MM-DD`:** Fetch ideas for a specific date
- **`--week`:** Fetch ideas for the current week
- **`--generate`:** Skip to generation directly

---

## Important

- NEVER summarize the ideas content — always show it in full
- The ideas file is saved to `00_inbox/` so the user can also open it in Obsidian
- Generated posts are saved to `03_creating/pipeline/` ready for review and publishing
