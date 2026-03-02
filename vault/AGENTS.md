# Second Brain - Agent Guide

This vault is a thinking system, not a file cabinet. Every folder, note, and link is part of how ideas connect and evolve. Treat it with care.

---

## Philosophy

- **Depth over breadth.** A few well-connected notes beat many shallow ones.
- **Network over perfection.** A note's value comes from its connections, not its polish.
- **Quality over speed.** Take time to understand context before creating or modifying.
- **Leave trails.** Every session should leave breadcrumbs that future sessions can follow.
- **Your role is curator.** The human decides what matters. You propose, connect, and draft.

---

## Orientation Protocol

Before doing anything, orient yourself:

1. **Structure first.** Read the folder tree to understand scope.
2. **INDEX.md second.** Scan the index for one-line descriptions of every note.
3. **MOC third.** Open the relevant topic page in `01_thinking/` to see grouped notes and accumulated context.
4. **Then the note.** Only now read individual notes.

Never modify a note without sufficient context. If unsure, read more before acting.

---

## Vault Structure

```
Second_Brain/
├── 00_inbox/              # Capture zone. Zero friction. Drop anything here.
├── 01_thinking/           # Your ideas, synthesis, and topic maps (MOCs).
│   ├── growth.md          # MOC: growth strategies and insights
│   ├── leadership.md      # MOC: leadership and management
│   ├── product.md         # MOC: product thinking
│   ├── life.md            # MOC: personal reflections
│   ├── content-creation.md # MOC: content engine learnings
│   └── notes/             # Individual atomic notes (your thinking)
├── 02_reference/          # External knowledge. Not your words.
│   ├── tools/             # Tool documentation and reviews
│   ├── approaches/        # External methods, strategies, case studies
│   └── sources/           # Books, podcasts, articles
│       ├── books/
│       ├── podcasts/
│       └── articles/
├── 03_creating/           # Content in progress.
│   ├── drafts/            # General drafts
│   ├── pipeline/          # Content engine posts (ready to publish)
│   └── scheduled/         # Posts scheduled for future publish
├── 04_published/          # Finished, published work.
├── 05_archive/            # Inactive content. Out of sight, not deleted.
├── 06_system/             # Templates, scripts, configuration.
│   ├── commands/          # Agent command prompts (answer, research, resource, therapy)
│   ├── content-engine/    # Voice profile, structures, learnings
│   ├── templates/
│   └── scripts/
├── AGENTS.md              # This file. The vault manual.
├── INDEX.md               # Quick orientation: every note, one line each.
└── attachments/           # Images, PDFs, non-text files.
```

---

## Naming Conventions

### New notes (01_thinking/notes/)
Name notes as **claims or assertions**, not topics:
- `quality-is-the-hard-part.md` not `thoughts-on-quality.md`
- `community-led-growth-beats-sales-led.md` not `growth-strategies.md`
- `deadlines-force-different-thinking.md` not `deadlines.md`

This makes the network readable: when you see a link like `[[quality-is-the-hard-part]]`, you already know the idea.

### Reference notes (02_reference/)
Keep original descriptive names. These are external content, not your claims.

### All files
- Lowercase, hyphenated: `my-note-name.md`
- No dates in filenames (use frontmatter if needed)
- No prefixes or numbering within folders

---

## Linking Convention: Wiki Links

Use `[[wiki links]]` integrated in the text, not reference lists at the bottom.

**Do this:**
> The insight from [[7-powers]] about counter-positioning explains why [[community-led-growth-beats-sales-led]] works — incumbents can't copy it without cannibalizing their sales team.

**Not this:**
> Counter-positioning explains community-led growth.
> Sources: 7-powers.md, community-growth.md

### Link rules:
- Link to the filename without extension: `[[evidence-clinical-ai]]`
- For notes in subfolders, use the full relative path only if ambiguous
- Every note should have at least one outgoing link
- When you create a new connection between existing notes, add the link in both directions
- Prefer linking in context (mid-sentence) over listing links at the end

---

## MOCs (Maps of Content)

MOCs live in `01_thinking/` and serve as **topic hubs**:

- They group related notes with brief context for each
- They accumulate "breadcrumbs" — observations the agent makes while navigating
- They are the first place to look when exploring a topic
- They should be updated whenever a new note is added to that topic

### MOC format:
```markdown
# Topic Name

Brief description of this thinking area.

---

## Key Notes

- [[note-name]] — one-line description of the insight
- [[another-note]] — what this adds to the topic

## Breadcrumbs

_Observations accumulated across sessions:_
- [date] Noticed that X connects to Y...
- [date] The pattern across these notes suggests...

## Open Questions

- What about...?
- Worth exploring...
```

---

## Agent Operating Principles

1. **Orient first, act second.** Always follow the orientation protocol before modifying anything.
2. **Create notes for emergent ideas.** When you notice a new insight that combines multiple existing notes, create a new note for it in `01_thinking/notes/` and link it.
3. **Add contextual links.** When you read a note and see a connection to another, add the `[[wiki link]]` inline.
4. **Update MOCs.** After working in a topic area, update the relevant MOC with new notes and breadcrumbs.
5. **Don't modify without context.** If you haven't read enough to understand a note's role in the network, don't change it.
6. **Leave notes for future sessions.** Add observations to MOC breadcrumbs so the next session starts with more context.
7. **Propose, don't impose.** For structural changes (moving files, renaming, merging notes), propose first and let the human decide.

---

## Content Engine

The content engine turns notes into published posts.

### System files (06_system/content-engine/):
- `voice-profile.md` — voice, audience, pillars, tone
- `structures.md` — proven post formats with templates
- `learnings.md` — weekly reviews and running insights

### Pipeline (03_creating/pipeline/):
Each post is a file tracking: idea → draft → ready → published

### Workflow:
1. **Plan** — search notes via the vault, pick topics, create pipeline files
2. **Write** — draft posts using source notes + voice profile + structures
3. **Review** — weekly review with performance data → update learnings

See `06_system/content-engine/` files for detailed instructions.

---

## Commands

The vault ships with ready-to-use command prompts in `06_system/commands/`. These are agent-agnostic — any CLI agent can read and execute them.

| Command | What it does | Prompt file |
|---------|-------------|-------------|
| `/answer` | Answer a question using **only** vault content | `06_system/commands/answer.md` |
| `/research` | Research a topic with web + vault, create a sourced note | `06_system/commands/research.md` |
| `/resource` | Ingest URL(s) into the vault as formatted notes | `06_system/commands/resource.md` |
| `/therapy` | Organize a brain dump into structured, linked notes | `06_system/commands/therapy.md` |

### How to use

**Claude Code:** Slash commands work automatically — type `/answer what is counter-positioning?`

**Any other agent:** Tell the agent to read the prompt file and follow it:
```
Read 06_system/commands/research.md and follow the instructions.
Topic: AI agents in healthcare
```

### When to use which command

- **Know it's in the vault?** → `/answer` (vault-only, no web)
- **Need fresh external info?** → `/research` (web + vault, creates a note)
- **Have a URL to save?** → `/resource` (summarize + ingest)
- **Head full of ideas?** → `/therapy` (brain dump → structured notes)

---

## Search with QMD

Before manual grep/glob, use `qmd` for smarter search:

```bash
qmd search "exact phrase"           # Full-text (fast, exact)
qmd vsearch "concept or idea"       # Semantic search
qmd query "broader topic"           # Combined (best quality)
qmd search "term" -c second-brain   # Search specific collection
```

---

## Maintenance

```bash
# After adding new .md notes:
qmd update && qmd embed

# Check index status:
qmd status
```
