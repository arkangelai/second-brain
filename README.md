# Second Brain

A local-first, AI-native knowledge management system. Markdown files + semantic search + any AI agent.

Built on [QMD](https://github.com/tobi/qmd) (by Tobi Lutke) for hybrid search, [Obsidian](https://obsidian.md) for reading and navigating, and any AI coding agent for synthesis and content creation.

**Zero cloud dependency for search. Everything runs on your machine.**

---

## Why This Exists

Most "second brain" setups are passive filing cabinets. This one is designed to be **actively queried by AI agents** — meaning your notes become a searchable, citable knowledge base that any LLM can tap into.

The stack:

| Layer | Tool | Purpose |
|-------|------|---------|
| **Storage** | Markdown files | Plain text, portable, future-proof |
| **Reading** | [Obsidian](https://obsidian.md) | Visual navigation, `[[wiki links]]`, graph view |
| **Search** | [QMD](https://github.com/tobi/qmd) | BM25 + vector + reranking — 100% local |
| **Agent** | Any (Claude Code, Cursor, Codex, etc.) | Reads, searches, and creates from your vault |
| **Sidebar** | [Claude Sidebar](https://github.com/derek-larson14/obsidian-claude-sidebar) | Claude Code terminal embedded in Obsidian |
| **CLI** | `second-brain` | Setup, search, scaffold, and draft from the terminal |
| **Publishing** | [Notion](https://notion.so) (optional) | Sync pipeline posts to a Notion database |

---

## Quickstart

### Prerequisites

- macOS or Linux
- [Bun](https://bun.sh) installed (`curl -fsSL https://bun.sh/install | bash`)
- [Obsidian](https://obsidian.md) installed (free, for reading/navigating your vault)

### Install

```bash
bun install -g @arkangelai/second-brain
```

Or run without installing:

```bash
bunx @arkangelai/second-brain init
```

### One-command setup

```bash
second-brain init
```

This installs QMD, creates your vault at `~/Documents/Second_Brain`, copies templates, indexes everything, and downloads the local AI models (~2GB on first run).

Custom vault path:

```bash
second-brain init --vault ~/my-vault
# or
export SECOND_BRAIN_PATH=~/my-vault
second-brain init
```

### Open in Obsidian

1. Open Obsidian
2. Click "Open folder as vault"
3. Select `~/Documents/Second_Brain`
4. Done — you'll see wiki links, graph view, and full navigation

### Activate Claude Sidebar

The `init` command automatically installs the [Claude Sidebar](https://github.com/derek-larson14/obsidian-claude-sidebar) plugin into your vault. To activate it:

1. Restart Obsidian (or reload: `Cmd+Shift+P` → "Reload app without saving")
2. Go to **Settings → Community Plugins → enable "Claude Sidebar"**

The plugin gives you a full Claude Code terminal right in your Obsidian sidebar — no need to switch between windows.

**What you get:**
- Embedded Claude Code terminal in Obsidian's sidebar panel
- Multi-tab support — run multiple Claude instances simultaneously
- Right-click any folder to launch Claude scoped to that directory
- Send selected text or file paths directly to Claude
- Drag-and-drop files onto the sidebar to reference them
- Multi-backend support — switch between Claude Code, Codex, OpenCode, or Gemini CLI

**Requirements:** [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/overview) must be installed and authenticated. The plugin runs the CLI inside Obsidian — it doesn't call the API directly.

### Your First Session

Once Obsidian is open and Claude Sidebar is active, click the Claude icon in the sidebar to start a terminal. Here's a three-step walkthrough to get your vault loaded and generating content:

#### Step 1 — Set up your voice profile

Tell Claude about yourself so it can write in your voice. Paste this into the sidebar:

```
Read AGENTS.md to orient yourself, then open 06_system/content-engine/voice-profile.md.

Interview me to fill it out: ask me about who I am, what I do, who my audience is,
my content pillars, my tone, and paste in any example posts I share. Update the file
with my answers as we go.
```

Claude will ask you questions about your background, audience, tone, and writing style, then fill in `voice-profile.md` for you.

#### Step 2 — Feed your vault

Your second brain is only as good as what's in it. Use the `/resource` command to import articles, YouTube videos, PDFs, or anything you've been thinking about:

**Claude Code:**
```
/resource https://example.com/article-i-liked
```

**Any agent:**
```
Read 06_system/commands/resource.md and follow the instructions.
Input: https://example.com/article-i-liked https://youtube.com/watch?v=video-id
```

You can feed it anything — book highlights, podcast episodes, blog posts, research papers. Each URL gets summarized and saved as a formatted note with wiki links to related content. The more you add, the richer the output when you generate content later.

#### Step 3 — Generate your first content

Now that your vault has a voice profile and some source material, try generating your first draft:

```bash
second-brain draft "a topic you care about"
```

Or use the vault commands directly in any agent:

**Claude Code:**
```
/research AI agents in healthcare
```

**Any agent:**
```
Read 06_system/commands/research.md and follow the instructions.
Topic: AI agents in healthcare
```

From here, review what the agent generated, edit in Obsidian, and iterate. The more notes and feedback you add to `learnings.md`, the better the output gets over time.

---

## CLI Commands

### `second-brain init`

Set up vault, install QMD, create config, index.

```bash
second-brain init
second-brain init --vault ~/custom/path
```

### `second-brain update`

Pull new templates (won't overwrite your files), update QMD, re-index.

```bash
second-brain update
```

### `second-brain status`

File counts per folder and QMD health check.

```bash
second-brain status
```

### `second-brain search "query"`

Hybrid search across your vault using QMD (BM25 + vector + reranking).

```bash
second-brain search "growth strategies"
second-brain search "AI in healthcare"
```

### `second-brain create note "title"`

Scaffold a new atomic note in `01_thinking/notes/`.

```bash
second-brain create note "quality is the hard part"
# → 01_thinking/notes/quality-is-the-hard-part.md
```

### `second-brain create post "title"`

Scaffold a new pipeline post in `03_creating/pipeline/`.

```bash
second-brain create post "AI replacing docs"
# → 03_creating/pipeline/ai-replacing-docs.md
```

### `second-brain draft "topic"`

**The killer feature.** Searches your vault, loads your voice profile + structures + learnings, assembles a rich prompt, and launches your AI agent.

```bash
second-brain draft "leadership lessons"
second-brain draft "AI in healthcare" --agent cursor
second-brain draft "growth" --agent codex
second-brain draft "founder content" --agent gateway
```

Agent detection order: `claude` > `cursor` > `codex` > `gateway` (gateway is used when an API key is configured).

What happens:
1. Searches vault via QMD for the 10 most relevant notes
2. Reads your voice profile, structures, and learnings
3. Assembles a prompt with all context + instructions
4. Launches the detected agent (or saves `.draft-prompt.md` if none found)

### `second-brain config <set|get> ...`

Configure AI Gateway credentials and default model:

```bash
# Save API key for gateway usage
second-brain config set apiKey "your_api_key"

# Save default model (optional)
second-brain config set model "deepinfra/deepseek-v3.2"

# Inspect current settings
second-brain config get apiKey
second-brain config get model
```

You can also set the key via environment variable:

```bash
export AI_GATEWAY_API_KEY="your_api_key"
```

When using `--agent gateway`, the CLI sends the assembled draft prompt (including vault search context) to the Vercel AI Gateway API.

### Notion Integration (`publish` / `pull`)

Set up Notion once:

```bash
# 1) Export your integration token in shell
export NOTION_API_TOKEN="secret_..."

# 2) Run guided setup (paste database URL or ID when prompted)
second-brain publish setup
```

What setup does:
- Validates database access
- Infers property mappings from your Notion schema
- Saves Notion integration config to `~/.config/second-brain/config.json`
- Stores auth as `"$NOTION_API_TOKEN"` reference in config

Publish local pipeline posts to Notion:

```bash
# Publish ready posts from 03_creating/pipeline
second-brain publish

# Preview only (no writes)
second-brain publish --dry-run

# Publish all statuses, or only specific status
second-brain publish --all
second-brain publish --status ready

# Publish one file
second-brain publish "my-post.md"

# Force update even if hash is unchanged
second-brain publish --force
```

After a successful live publish/update, files are moved from `03_creating/pipeline/` to `04_published/`.

Pull Notion properties/metrics back into local markdown:

```bash
# Pull for all posts in 04_published
second-brain pull

# Pull one file
second-brain pull "my-post.md"

# Preview only (no file writes)
second-brain pull --dry-run
```

`pull` updates mapped metadata fields and writes a `## Metrics` section in the markdown file when mapped pull fields are available.

### Global Options

```bash
--vault <path>      Override vault path
--agent <name>      Agent for draft: claude, cursor, codex, gateway
--model <id>        Model id for gateway draft requests
--dry-run           Preview publish/pull actions without writing
--force             Re-publish even when hash matches
--all               Publish all pipeline posts regardless of status
--status <value>    Publish only posts with this status
--version, -v       Show version
--help, -h          Show help
```

### Vault Path Resolution

Priority order:
1. `--vault` flag
2. `$SECOND_BRAIN_PATH` environment variable
3. `~/.config/second-brain/config.json`
4. `~/Documents/Second_Brain` (default)

---

## Vault Commands

Your vault ships with 4 agent-agnostic commands — prompt files in `06_system/commands/` that any CLI agent can read and execute. Claude Code users also get `/slash` commands automatically.

| Command | What it does |
|---------|-------------|
| `/answer` | Answer a question using **only** vault content — no web |
| `/research` | Research a topic with web + vault, create a sourced note |
| `/resource` | Ingest URL(s) into the vault as formatted notes |
| `/therapy` | Organize a brain dump into structured, linked notes |
| `/schedule` | Schedule ready pipeline posts to X/LinkedIn via Post-Bridge |

### Usage

**Claude Code** (slash commands work automatically):

```
/answer what is counter-positioning?
/research AI agents in healthcare 2026
/resource https://paulgraham.com/startupideas.html
/therapy I've been thinking about three things: first, the way our product...
```

**Any other CLI agent** (Cursor, Codex, OpenCode, etc.):

Tell the agent to read the prompt file and follow it:

```
Read 06_system/commands/answer.md and follow the instructions.
Question: what is counter-positioning?
```

```
Read 06_system/commands/resource.md and follow the instructions.
Input: https://paulgraham.com/startupideas.html
```

### When to use which command

| Situation | Command |
|-----------|---------|
| You know it's in the vault | `/answer` — vault-only search, no web |
| You need fresh external info | `/research` — web + vault, creates a note |
| You have a URL to save | `/resource` — summarize + ingest |
| Your head is full of ideas | `/therapy` — brain dump → structured notes |
| Ready posts need scheduling | `/schedule` — schedule to X/LinkedIn via Post-Bridge |

### Customizing commands

The prompt files live in `06_system/commands/`. Edit them to match your workflow — change the note formats, default folders, output language, or add new commands.

To add a new command, create a new `.md` file in `06_system/commands/` with the prompt instructions. For Claude Code slash command support, also create a matching file in `.claude/commands/` with a `$ARGUMENTS` reference.

---

## Vault Structure

```
Second_Brain/
├── INDEX.md                  # Table of contents — start here
├── AGENTS.md                 # Agent operating manual (the core prompt)
│
├── 00_inbox/                 # Capture zone. Drop anything here.
├── 01_thinking/              # YOUR ideas + Maps of Content (MOCs)
│   ├── growth.md             # MOC: growth, go-to-market, distribution
│   ├── product.md            # MOC: product thinking, workflows
│   ├── leadership.md         # MOC: leading teams, decisions
│   ├── life.md               # MOC: personal reflections, identity
│   ├── content-creation.md   # MOC: content engine, voice, pipeline
│   └── notes/                # Atomic notes (your original thinking)
├── 02_reference/             # External knowledge — don't modify
│   ├── approaches/           # Strategies, case studies, methods
│   ├── tools/                # Tool documentation and reviews
│   └── sources/
│       ├── books/            # Book notes and summaries
│       ├── podcasts/         # Podcast episode notes
│       └── articles/         # Article summaries
├── 03_creating/              # Work in progress
│   ├── drafts/               # General drafts
│   ├── pipeline/             # Content ready to publish
│   └── scheduled/            # Posts scheduled for future publish
├── 04_published/             # Finished, published work
├── 05_archive/               # Inactive content (out of sight, not deleted)
└── 06_system/                # Templates, scripts, configuration
    ├── commands/             # Agent command prompts
    │   ├── answer.md         # /answer — ask the vault
    │   ├── research.md       # /research — web + vault research
    │   ├── resource.md       # /resource — ingest URLs
    │   ├── therapy.md        # /therapy — brain dump → notes
    │   └── schedule.md       # /schedule — schedule posts to X/LinkedIn
    ├── content-engine/
    │   ├── voice-profile.md  # Your voice, audience, pillars, tone
    │   ├── structures.md     # Proven post formats with templates
    │   └── learnings.md      # Weekly reviews and running insights
    ├── templates/
    │   ├── note.md           # Template for new atomic notes
    │   ├── moc.md            # Template for new MOCs
    │   ├── book.md           # Template for book notes
    │   └── pipeline-post.md  # Template for content pipeline posts
    └── scripts/
        └── txt-to-md.sh      # Convert .txt files to .md
```

---

## Key Files Explained

### `INDEX.md` — Your Table of Contents

A flat list of every note in the vault with a one-line summary. This is the first thing an agent reads to orient itself.

### `AGENTS.md` — The Agent Operating Manual

This is the most important file. It tells any AI agent:
- **How to orient**: Structure → INDEX → MOC → Note (never skip steps)
- **How to name notes**: As claims (`quality-is-the-hard-part.md`), not topics (`quality.md`)
- **How to link**: `[[wiki links]]` inline, not reference lists
- **How to update MOCs**: Add breadcrumbs for future sessions
- **Philosophy**: Depth over breadth, network over perfection, curator not modifier

### MOCs (Maps of Content) — Topic Hubs

Each file in `01_thinking/` groups related notes with context. They accumulate "breadcrumbs" — observations the agent makes while navigating. This is how knowledge compounds across sessions.

### `06_system/content-engine/` — Content Creation System

Three files that turn your accumulated knowledge into published content:
- `voice-profile.md` — Who you are, your audience, your tone
- `structures.md` — Proven post formats with fill-in templates
- `learnings.md` — What worked, what didn't, running insights

See the [Content Engine](#content-engine) section below for the full workflow.

---

## How QMD Search Works

QMD provides three search modes, all running locally:

```bash
qmd search "exact phrase"       # Fast BM25 keyword search
qmd vsearch "concept or idea"   # Semantic vector search
qmd query "broader topic"       # Hybrid + reranking (best quality, slower)
```

Or use the CLI wrapper:

```bash
second-brain search "broader topic"   # Runs qmd query under the hood
```

### Under the Hood

```
Your Query
    ↓
Query Expansion (Qwen3-1.7B) → generates 2 variants
    ↓
Parallel search:
  ├── BM25 (SQLite FTS5) ── keyword matching
  └── Vector (sqlite-vec) ── semantic similarity
    ↓
Reciprocal Rank Fusion → combines results
    ↓
LLM Reranking (Qwen3-0.6B) → reorders by relevance
    ↓
Top results with scores
```

### Local Models (downloaded automatically on first use)

| Model | Size | Purpose |
|-------|------|---------|
| `embeddinggemma-300M` | ~300MB | Embeddings |
| `qwen3-reranker-0.6B` | ~640MB | Reranking |
| `qmd-query-expansion-1.7B` | ~1.1GB | Query expansion |

### QMD as MCP Server

QMD can run as an [MCP server](https://modelcontextprotocol.io), giving any compatible agent direct access to your vault:

```bash
# Start MCP server (stdio — for Claude Code, Cursor, etc.)
qmd mcp

# Start MCP server (HTTP — for remote agents)
qmd mcp --http --port 8181
```

**Exposed tools via MCP:**
- `qmd_search` — BM25 keyword search
- `qmd_vector_search` — Semantic search
- `qmd_deep_search` — Hybrid + reranking
- `qmd_get` — Get document by path or docid
- `qmd_multi_get` — Batch document retrieval
- `qmd_status` — Index health check

---

## Using With Any AI Agent

The vault is agent-agnostic. Point any coding agent at `~/Documents/Second_Brain` and it works.

### Claude Code

```bash
# Navigate to your vault
cd ~/Documents/Second_Brain

# Start Claude Code — it reads AGENTS.md automatically
claude
```

Or use QMD as an MCP server in `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "qmd": {
      "command": "qmd",
      "args": ["mcp"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "qmd": {
      "command": "qmd",
      "args": ["mcp"]
    }
  }
}
```

Or simply open the vault folder in Cursor and paste the agent prompt from `AGENTS.md`.

### OpenAI Codex CLI

```bash
cd ~/Documents/Second_Brain
codex
```

Codex will read the `AGENTS.md` file. You can also paste the agent instructions directly.

### Any Other Agent

1. Point the agent to `~/Documents/Second_Brain`
2. Tell it to read `AGENTS.md` first
3. It now knows how to navigate, search, and create in your vault

---

## First Prompts to Try

Once your vault is set up and you're inside an agent, try these:

### 1. Orient the agent

```
Read AGENTS.md and INDEX.md. Give me a summary of what's in this vault.
```

### 2. Search your knowledge

```
Search the vault for notes about [your topic]. Summarize the key insights
and how they connect to each other.
```

### 3. Create a new note from an idea

```
I just learned that [insight]. Create a new atomic note in 01_thinking/notes/
following the naming conventions in AGENTS.md. Link it to any related
existing notes and update the relevant MOC.
```

### 4. Add a book or podcast

```
Here are my notes from [Book Title]: [paste notes]

Create a reference note in 02_reference/sources/books/ and connect it
to relevant thinking notes. Update the INDEX.
```

### 5. Weekly review

```
Search all notes modified this week. Summarize what was added,
what connections were made, and suggest 3 notes that should exist
but don't yet. Add breadcrumbs to the relevant MOCs.
```

### 6. Draft content (or just use the CLI!)

```bash
second-brain draft "your topic here"
```

---

## Content Engine

The real power of a second brain isn't storing information — it's **generating new things from everything you've accumulated**. Books, social media posts, articles, presentations, newsletters. The more you capture, the richer the output.

The content engine is the system that turns your vault into a publishing machine.

### How It Works

```
  Your vault (months/years of notes, books, ideas, references)
      ↓
  second-brain draft "topic" (or agent searches manually)
      ↓
  Finds connections you didn't see
      ↓
  Drafts content in YOUR voice using YOUR structures
      ↓
  You review in Obsidian → edit → publish
      ↓
  Track what worked → feed learnings back into the system
```

The key insight: **the agent has access to your entire history of thinking**. It doesn't just write from a prompt — it writes from hundreds of notes, book summaries, podcast insights, and your own accumulated observations. That's what makes the output uniquely yours.

### Setup (One Time)

Edit these three files in `06_system/content-engine/`:

**1. `voice-profile.md`** — Teach the agent who you are:
- Your company, audience, and content pillars
- Your tone (direct? reflective? technical? casual?)
- Paste 3-5 of your best posts as calibration examples
- List what you do NOT sound like (corporate jargon, hype, etc.)

**2. `structures.md`** — Give it proven formats to use:
- 8 templates included (counterintuitive truth, hard truth list, personal lesson, etc.)
- Each has a pattern, a fill-in template, and which platform it works for
- Add your own as you find posts you love

**3. `learnings.md`** — Build a feedback loop:
- Weekly: what performed well, what didn't, why
- Running insights that accumulate over time
- The agent reads this before drafting to avoid repeating mistakes

### Content Creation with the CLI

The fastest way to draft content:

```bash
# Draft posts about a topic
second-brain draft "leadership lessons"

# Use a specific agent
second-brain draft "AI in healthcare" --agent cursor

# Scaffold a pipeline post manually
second-brain create post "why quality compounds"
```

### Content Creation with Agent Prompts

#### Social media posts (X / LinkedIn)

```
Read voice-profile.md and structures.md from 06_system/content-engine/.
Then search the vault for ideas about [topic].

Draft 3 post options:
- 1 for X (Twitter) using "The Counterintuitive Truth" structure
- 1 for LinkedIn using "The Personal Lesson" structure
- 1 for LinkedIn using "The Framework Share" structure

Use insights from actual vault notes. Cite which notes inspired each post.
Check learnings.md to avoid patterns that underperformed.
```

#### Generate a week of content

```
Read voice-profile.md, structures.md, and learnings.md from the content engine.
Search the vault for the strongest ideas across all MOCs.

Plan 5 posts for this week:
- Mon: X post (observation or counterintuitive truth)
- Tue: LinkedIn post (personal lesson)
- Wed: X + LinkedIn (hard truth list or framework)
- Thu: Product update / build in public (both platforms)
- Fri: "Here's what we're seeing" or "We used to think" (both)

For each post: pick an idea, choose a structure, write the draft,
and note which vault sources informed it.
Create each as a pipeline file in 03_creating/pipeline/.
```

#### Write an article or essay

```
I want to write a long-form article about [topic].

1. Search the entire vault for related notes — books, podcast episodes,
   approaches, and my own thinking notes
2. Outline the article with sections, using the strongest insights
   from across the vault
3. For each section, cite the specific notes that support the argument
4. Write the first draft (~1500 words), weaving together ideas from
   different sources into a coherent narrative
5. Use the voice from voice-profile.md

Save the draft in 03_creating/drafts/.
```

#### Write a book chapter

```
I'm writing a book about [topic]. This is chapter [N]: [chapter title].

1. Search the vault exhaustively — books I've read, podcast insights,
   strategies, case studies, and my own thinking notes related to this chapter
2. Create a detailed outline with the key arguments and supporting evidence
3. Write the chapter draft (~3000 words), synthesizing insights
   from across my entire knowledge base
4. Include [[wiki links]] to source notes so I can verify and expand later
5. Match the voice in voice-profile.md

Save in 03_creating/drafts/book/chapter-[N]-[title].md
```

#### Write a newsletter edition

```
Read the content engine files and search the vault for the most
interesting ideas I've captured recently.

Write a newsletter edition:
- Subject line: compelling, not clickbait
- Opening: a personal hook or observation
- Body: 2-3 insights from my vault, connected with a thread
- Close: a question or takeaway for the reader
- Tone: voice-profile.md

Save in 03_creating/drafts/.
```

#### Repurpose existing content

```
Read [path to published post or article in 04_published/].

Now search the vault for related notes that could expand on this.
Create 3 derivative pieces:
1. A Twitter thread that breaks down the main argument
2. A LinkedIn post with a different angle on the same idea
3. A short article draft that goes deeper using vault sources

Save all three in 03_creating/pipeline/.
```

### The Content Pipeline

Content moves through folders as it progresses:

```
03_creating/drafts/      → work in progress, rough ideas
03_creating/pipeline/    → ready to publish (status: ready)
03_creating/scheduled/   → queued for a future date
04_published/            → live, published content
```

Each pipeline file tracks metadata as bold key-value pairs:

```markdown
# Post Title

**Status:** draft
**Platform:** LinkedIn
**Pillar:** Business Strategy
**Structure:** The Personal Lesson
**Source notes:** [[7-powers]], [[crossing-the-chasm]], [[blitzscaling]]

## Core Idea
What's the one takeaway?

## Draft
The actual post text.

## Notes
Revisions, alternatives, performance after publishing.
```

When you run `second-brain publish`, ready posts in `03_creating/pipeline/` are pushed to Notion and automatically moved to `04_published/`. After publishing, use `second-brain pull` to sync metrics back from Notion into your local files. Log results in `learnings.md` to improve future drafts.

### Why This Gets Better Over Time

The more you use it, the better it gets:

1. **More notes = richer output.** A vault with 50 notes produces decent content. A vault with 500 notes produces content that connects ideas no human would think to combine.
2. **Learnings compound.** The agent reads `learnings.md` before every draft. Patterns that work get reinforced. Patterns that don't get avoided.
3. **MOC breadcrumbs guide the agent.** Every session leaves trails that make the next session smarter.
4. **Your voice sharpens.** As you add best-performing posts to `voice-profile.md`, the agent's calibration improves.

---

## Updating

When we release new templates, structures, or improvements:

```bash
# Update the CLI
bun install -g @arkangelai/second-brain

# Pull new templates into your vault (won't overwrite your files)
second-brain update
```

---

## Maintenance

```bash
# After adding new markdown files:
qmd update && qmd embed

# After adding .txt files (converts to .md first):
./06_system/scripts/txt-to-md.sh

# Check vault health:
second-brain status

# Or directly:
qmd status
```

### Important Rules

- **Never run** `qmd collection add`, `qmd embed`, or `qmd update` automatically from an agent
- **Never modify** the SQLite database directly
- The index lives at `~/.cache/qmd/index.sqlite`
- QMD models download automatically on first use (~2GB total)

---

## Customizing for Your Use Case

### 1. Edit `AGENTS.md`

Adapt the orientation protocol, naming conventions, and linking rules to your workflow.

### 2. Edit the MOCs in `01_thinking/`

Replace the example MOCs (growth, product, leadership, life, content-creation) with your own topics. Each MOC is a hub for a thinking area.

### 3. Edit `voice-profile.md`

Replace with your own voice, audience, pillars, and tone. This drives the content engine.

### 4. Edit `structures.md`

Keep the formats that work for you, remove the rest, add new ones as you find posts you love.

### 5. Add QMD context annotations

```bash
# Add context to help QMD understand your collections
qmd context add ~/Documents/Second_Brain "Personal knowledge base with notes on business, AI, product, and leadership"
qmd context add ~/Documents/Second_Brain/02_reference/sources/books "Book summaries and key insights"
```

---

## Optional Integrations

These are **entirely optional**. The vault works fully without them. Set them up when you're ready to publish content or use the AI gateway for drafting.

### Notion (Publish & Pull)

Sync your content pipeline to a Notion database. Posts in `03_creating/pipeline/` get pushed to Notion, and metrics from Notion get pulled back into your local files.

**What you need:**
- A [Notion integration](https://www.notion.so/my-integrations) with access to your content database
- The integration token (starts with `secret_...`)

**Safe setup (3 steps):**

```bash
# Step 1: Add your Notion token to your shell environment.
# Open ~/.zshrc (or ~/.bashrc) in a text editor and add:
export NOTION_API_TOKEN="secret_your_token_here"

# Then reload your shell:
source ~/.zshrc

# Step 2: Run the guided setup (paste your database URL when prompted).
second-brain publish setup

# Step 3: Verify it worked.
second-brain publish --dry-run
```

Your token is stored as an environment variable reference (`$NOTION_API_TOKEN`) in the config file — **the actual secret never touches the config**. This means your AI agents can read the config safely without seeing your credentials.

**How it works:**
- `second-brain publish` — pushes ready posts from `03_creating/pipeline/` to Notion, then moves them to `04_published/`
- `second-brain publish --dry-run` — preview what would be published without writing
- `second-brain pull` — syncs metrics and properties from Notion back into local markdown files
- Files are tracked by SHA-256 hash, so unchanged files are skipped automatically

See the [CLI Commands](#notion-integration-publish--pull) section above for all flags and options.

### AI Gateway (Draft Without a CLI Agent)

If you don't have Claude Code, Cursor, or Codex installed, you can still use `second-brain draft` via the AI Gateway — an OpenAI-compatible API endpoint that streams responses directly to your terminal.

**What you need:**
- An API key for the gateway (contact your team or provider)

**Safe setup (2 steps):**

```bash
# Option A: Environment variable (recommended — never stored on disk)
export AI_GATEWAY_API_KEY="your_api_key"

# Option B: Store in config (masked when displayed)
second-brain config set apiKey "your_api_key"

# Optional: change the default model
second-brain config set model "deepinfra/deepseek-v3.2"
```

**How it works:**
- The gateway is auto-detected as the last fallback when no CLI agent is found but an API key is configured
- Override explicitly with `--agent gateway`
- Output streams to your terminal and is saved as a pipeline post in `03_creating/pipeline/`

```bash
second-brain draft "leadership lessons" --agent gateway
second-brain draft "AI in healthcare" --agent gateway --model "deepinfra/deepseek-v3.2"
```

### Post-Bridge (Social Media Scheduling)

Schedule posts from your content pipeline directly to X and LinkedIn. Posts in `03_creating/pipeline/` with status `ready` are sent to the Post-Bridge API, which handles the actual publishing at the scheduled time.

**What you need:**
- A [Post-Bridge](https://post-bridge.com) account with connected social accounts
- An API key from Post-Bridge

**Safe setup (3 steps):**

```bash
# Step 1: Add your Post-Bridge API key to your shell environment.
# Open ~/.zshrc (or ~/.bashrc) and add:
export POST_BRIDGE_API_KEY="your_api_key_here"

# Then reload your shell:
source ~/.zshrc

# Step 2: Install dependencies and discover your social accounts.
cd tools/post-bridge && bun install
bun run src/index.ts accounts

# Step 3: Verify it worked.
bun run src/index.ts list
```

**How it works:**
- `/schedule` command (or `bun run schedule-week`) scans the pipeline for ready posts
- Each post is scheduled to X, LinkedIn, or both based on its `Platform` field
- Posts are scheduled one per weekday (Mon-Fri) at 08:00 COT by default
- The pipeline file's `Publish date` field is updated automatically

```bash
# Schedule a single post
bun --cwd tools/post-bridge run src/index.ts schedule my-post.md --date 2026-03-02

# Auto-schedule all ready posts starting next Monday
bun --cwd tools/post-bridge run src/index.ts schedule-week --start 2026-03-02

# Check scheduled posts
bun --cwd tools/post-bridge run src/index.ts list --status scheduled

# Check publish results
bun --cwd tools/post-bridge run src/index.ts results
```

### Security Notes

All integrations follow the same principle: **secrets live in your shell environment, not in files agents can read**.

| Secret | How to set | Stored as |
|--------|-----------|-----------|
| `NOTION_API_TOKEN` | Shell environment (`~/.zshrc`) | `"$NOTION_API_TOKEN"` reference in config |
| `AI_GATEWAY_API_KEY` | Shell environment or `config set apiKey` | Env var (preferred) or config file |
| `POST_BRIDGE_API_KEY` | Shell environment (`~/.zshrc`) | Env var only (not stored in config) |

The config file at `~/.config/second-brain/config.json` stores Notion auth as an environment variable reference string, not the raw token. The `config get apiKey` command masks the key (shows only first 4 and last 4 characters). This means you can safely let any AI agent read your vault and config without exposing credentials.

---

## How It All Connects

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  You write   │────▶│  QMD indexes │────▶│  Agent reads │
│  in Obsidian │     │  locally     │     │  and searches│
└─────────────┘     └─────────────┘     └─────────────┘
       │                                        │
       │              ┌─────────────┐           │
       └──────────────│  Agent adds  │◀──────────┘
                      │  notes, links│
                      │  breadcrumbs │
                      └─────────────┘
```

1. **You capture** ideas in Obsidian (or any text editor)
2. **QMD indexes** everything locally (BM25 + vectors)
3. **Any AI agent** searches and reads via QMD or direct file access
4. **The agent creates** new notes, adds links, updates MOCs
5. **You review** in Obsidian — approve, edit, or discard
6. **Knowledge compounds** across sessions via MOC breadcrumbs

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Files | Markdown (.md) |
| Reader | Obsidian (free) |
| Obsidian plugin | [Claude Sidebar](https://github.com/derek-larson14/obsidian-claude-sidebar) v1.7.1 |
| CLI | `@arkangelai/second-brain` (Bun, zero deps) |
| Search engine | QMD |
| Database | SQLite + FTS5 + sqlite-vec |
| Embeddings | EmbeddingGemma-300M (GGUF, local) |
| Reranking | Qwen3-0.6B (GGUF, local) |
| Query expansion | Qwen3-1.7B (GGUF, local) |
| LLM runtime | node-llama-cpp |
| Package manager | Bun |
| Agent protocol | MCP (Model Context Protocol) |
| Publishing | Notion API (`@notionhq/client`) — optional |
| Scheduling | Post-Bridge API (`tools/post-bridge/`) — optional |
| AI Gateway | Vercel AI Gateway (OpenAI-compatible) — optional |

---

## License

MIT

---

Built by [Arkangel AI](https://arkangel.ai). We build AI tools for healthcare.
