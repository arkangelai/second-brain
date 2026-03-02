# /research — Research a topic

Research a topic combining vault knowledge with web sources, then create a comprehensive note.

**Input:** {topic}

## Workflow

### 1. Check the vault first

Search for existing content on this topic:

```bash
qmd vsearch "{topic}" -n 5
qmd search "{key terms}" -n 5
```

Read the top 2-3 results if they exist. This gives you:
- Context on what the vault already covers (avoid duplicating)
- Angles and frameworks the user has engaged with before
- Related notes to link in the final output

### 2. Web search

Search the web for 4-6 high-quality sources on the topic. Prioritize:
- Recent articles (2024-2026) over older ones
- Primary sources (research, official docs) over aggregators
- Diverse perspectives — not all from the same site
- Practitioner content (case studies, real experience) over generic overviews

### 3. Summarize each source

For each promising URL from the search results:

```bash
summarize "<url>" --length medium --plain
```

If `summarize` fails on a URL, try `--extract` or fetch the URL directly as fallback. Skip sources that can't be accessed.

### 4. Generate filename

- Lowercase, hyphen-separated, English preferred
- Derived from the topic
- Check that the file doesn't already exist before writing
- Examples: `ai-agents-healthcare-2026.md`, `competitive-moats-saas.md`

### 5. Determine target folder

Based on the topic:
- Business ideas, strategies, growth concepts → `02_reference/approaches/`
- Personal/philosophical topics → `01_thinking/notes/`
- Tool or technology research → `02_reference/tools/`
- Book or article insights → `02_reference/sources/articles/`

The user can override by saying "in <folder>" in their input.

### 6. Create the note

```markdown
# Topic Title

> Source: Research — {date}

## Summary

2-3 paragraph synthesis of the research. Not a copy of any single source — a unified view combining the best ideas from all sources and existing vault knowledge.

## Key Ideas

### Idea/framework/finding 1
- Key points from sources
- **Bold key takeaway or data point**
- Connection to existing vault content if relevant

### Idea/framework/finding 2
- Key points
- **Bold key insight**

### Idea/framework/finding 3
- Key points

## Sources

- [Article title](url) — brief note on what it contributed
- [Article title](url) — brief note

---

**Related notes:** [[existing-note-1]], [[existing-note-2]]
```

### 7. Quality checks

Before writing the file:
- The note synthesizes across sources — it's not just a list of summaries
- Key data points, stats, and frameworks are preserved with **bold emphasis**
- The language matches the user's input language
- Wiki links use `[[filename]]` only — no path, no extension
- Sources section has working URLs

### 8. Write and index

Write the file, then:

```bash
qmd update && qmd embed
```

### 9. Report

Show the user:
- File path created
- 3-4 key ideas discovered
- Number of sources used
- Related vault notes found
