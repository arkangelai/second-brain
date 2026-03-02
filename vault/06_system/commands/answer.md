# /answer — Ask the vault

Answer a question using **only** content from the vault. Do not use external knowledge or web searches.

**Input:** {question}

## Workflow

### 1. Search the vault

Run multiple searches to find relevant notes:

```bash
# Semantic search — best for conceptual questions
qmd vsearch "{core concept}" -n 8

# Full-text search — best for specific terms, names, frameworks
qmd search "{specific term}" -n 8
```

Run at least 2 different searches (semantic + text) to maximize coverage.

### 2. Read the top results

Use `qmd get <uri>` or read the top 3-5 most relevant notes in full. Skim others for additional context.

### 3. Synthesize the answer

Write a clear, direct answer that:
- Opens with a heading: `## <rephrased question as a statement>`
- Uses 1-3 paragraphs synthesizing what the vault says, with **bold** for key terms and frameworks
- Attributes ideas to their source notes naturally (e.g., "As discussed in the 7 Powers summary..." or "From the Brian Chesky episode...")
- Connects ideas across multiple notes — the value is in the synthesis, not just listing
- Matches the language of the question (Spanish question → Spanish answer, English → English)

### 4. Cite sources

After the synthesized answer, add:

```
---

**Vault sources:**
- `folder/filename.md` — brief description of what it contributed
- `folder/filename.md` — brief description

**Related notes:** [[filename1]], [[filename2]], [[filename3]]
```

Use `[[wiki links]]` (filename only, no path, no extension) for the related notes section.

### 5. Handle insufficient content

If the vault has little or no content on the topic:

> I didn't find enough content in the vault on this topic. Existing notes don't cover {topic} directly.
>
> You can use `/research {topic}` to research this topic and create a note with external sources.

Still show any tangentially related notes that might be useful.
