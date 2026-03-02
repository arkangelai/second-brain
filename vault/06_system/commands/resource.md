# /resource — Ingest a URL into the vault

Summarize URL(s) and create formatted vault note(s).

**Input:** {urls}

## Workflow

### 1. Parse input and classify each URL

Extract all URLs from the input. For each URL, classify its type and assign defaults:

| Type | Detection | Default folder | Summarize length |
|------|-----------|---------------|-----------------|
| Article/blog | General web URL | `02_reference/sources/articles/` | `medium` |
| YouTube video | youtube.com, youtu.be | `02_reference/sources/articles/` | `long` |
| Podcast episode | podcast URLs, Spotify, Apple | `02_reference/sources/podcasts/` | `long` |
| PDF | .pdf extension | `02_reference/sources/books/` | `long` |

The user can override the folder by saying "in <folder>" in their input.

### 2. Summarize each URL

Use the `summarize` CLI if available (`brew install summarize` or see [github.com/stefanpejcic/summarize](https://github.com/stefanpejcic/summarize)). If it's not installed, fetch and summarize the URL content directly using your built-in web/file reading capabilities.

**With `summarize` CLI (preferred):**

```bash
# Primary: plain text summary
summarize "<url>" --length <appropriate> --plain

# Fallback 1: JSON output (parse the summary from JSON)
summarize "<url>" --length <appropriate> --json

# Fallback 2: extract only (no LLM, just raw content)
summarize "<url>" --extract
```

**Without `summarize`:** Fetch the URL content directly (web fetch, curl, etc.), read it, and produce your own summary. The output format should be the same either way.

### 3. Generate filename

- Lowercase, hyphen-separated, English preferred
- Derived from the title or main topic
- Check that the file doesn't already exist before writing
- Examples: `ai-agents-healthcare.md`, `pricing-psychology-saas.md`

### 4. Format the note

```markdown
# Title of the Content

> Source: [Source Name/Author](original-url)

## Summary

2-3 paragraph summary of the core content.

## Key Ideas

### Idea 1 title
- Key point
- **Bold key takeaway**

### Idea 2 title
- Key point
- Key point

## Sources

- [Original title](original-url)

---

**Related notes:** [[related-note-1]], [[related-note-2]]
```

### 5. Find related notes

```bash
qmd vsearch "<main topic of the URL>" -n 5
```

Add the top 2-4 related notes as `[[wiki links]]` in the Related notes section. Use filename only — no path, no extension.

### 6. Write the file

Create the note in the target folder. Verify the file was created.

### 7. Index

```bash
qmd update && qmd embed
```

### 8. Report

For multiple URLs, show a summary table:

```
| # | URL | Status | File created |
|---|-----|--------|-------------|
| 1 | https://... | done | folder/filename.md |
| 2 | https://... | failed | — |
```

For a single URL, confirm the file path and show 2-3 key ideas from the note.
