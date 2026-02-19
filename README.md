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

---

## Quickstart

### Prerequisites

- macOS or Linux
- [Bun](https://bun.sh) installed (`curl -fsSL https://bun.sh/install | bash`)
- [Obsidian](https://obsidian.md) installed (free, for reading/navigating your vault)

### One-command setup

```bash
curl -fsSL https://raw.githubusercontent.com/arkangelai/second-brain/main/setup.sh | bash
```

Or step by step:

```bash
# 1. Clone this repo
git clone https://github.com/arkangelai/second-brain.git ~/Documents/Second_Brain

# 2. Install QMD globally
bun install -g @tobilu/qmd

# 3. Create the QMD config
mkdir -p ~/.config/qmd
cat > ~/.config/qmd/index.yml << 'EOF'
collections:
  second-brain:
    path: ~/Documents/Second_Brain
    pattern: "**/*.md"
EOF

# 4. Index your vault
qmd collection add ~/Documents/Second_Brain --name second-brain
qmd embed

# 5. Verify it works
qmd status
qmd query "how to get started"
```

### Open in Obsidian

1. Open Obsidian
2. Click "Open folder as vault"
3. Select `~/Documents/Second_Brain`
4. Done — you'll see wiki links, graph view, and full navigation

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
│   └── pipeline/             # Content pipeline (idea → draft → ready)
├── 04_published/             # Finished, published work
├── 05_archive/               # Inactive content (out of sight, not deleted)
└── 06_system/                # Templates, scripts, configuration
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

Optional but powerful. Three files that turn your notes into published content:
- `voice-profile.md` — Who you are, your audience, your tone
- `structures.md` — Proven post formats with fill-in templates
- `learnings.md` — What worked, what didn't, running insights

---

## How QMD Search Works

QMD provides three search modes, all running locally:

```bash
qmd search "exact phrase"       # Fast BM25 keyword search
qmd vsearch "concept or idea"   # Semantic vector search
qmd query "broader topic"       # Hybrid + reranking (best quality, slower)
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

### 5. Draft content from your notes

```
Read the voice profile in 06_system/content-engine/voice-profile.md and
the structures in structures.md. Then search the vault for ideas about
[topic] and draft 3 post options — one for X and two for LinkedIn.
```

### 6. Weekly review

```
Search all notes modified this week. Summarize what was added,
what connections were made, and suggest 3 notes that should exist
but don't yet. Add breadcrumbs to the relevant MOCs.
```

### 7. Deep research synthesis

```
I need to understand [complex topic]. Search the vault for all related
notes, then synthesize them into a structured brief. Cite sources
using [[wiki links]].
```

---

## Maintenance

```bash
# After adding new markdown files:
qmd update && qmd embed

# After adding .txt files (converts to .md first):
./06_system/scripts/txt-to-md.sh

# Check index health:
qmd status

# See what's indexed:
qmd collection list
qmd ls second-brain
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
| Search engine | QMD |
| Database | SQLite + FTS5 + sqlite-vec |
| Embeddings | EmbeddingGemma-300M (GGUF, local) |
| Reranking | Qwen3-0.6B (GGUF, local) |
| Query expansion | Qwen3-1.7B (GGUF, local) |
| LLM runtime | node-llama-cpp |
| Package manager | Bun |
| Agent protocol | MCP (Model Context Protocol) |

---

## License

MIT

---

Built by [Arkangel AI](https://arkangel.ai). We build AI tools for healthcare.
