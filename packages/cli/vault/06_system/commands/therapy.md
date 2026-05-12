# /therapy — Organize a brain dump

Take a brain dump and organize it into structured, linked vault notes.

**Input:** {brain dump}

## Workflow

### 1. Parse the brain dump

Read the full input carefully. Identify 2-6 distinct topics, ideas, or threads. Each topic should be substantial enough for its own note — don't over-split into tiny fragments, but don't lump unrelated ideas together either.

### 2. Present topics for confirmation

**IMPORTANT: Do NOT create files yet.** First, present the identified topics to the user:

```
I identified these topics in your brain dump:

1. **[Topic title]** — [1-sentence description]. → `01_thinking/notes/filename.md`
2. **[Topic title]** — [1-sentence description]. → `02_reference/approaches/filename.md`
3. **[Topic title]** — [1-sentence description]. → `01_thinking/notes/filename.md`

Should I proceed with these? You can:
- Remove a topic (e.g., "skip 2")
- Merge topics (e.g., "merge 1 and 3")
- Change the folder (e.g., "put 2 in 02_reference")
- Rename a topic
- Add a topic I missed
```

Wait for user confirmation before creating any files.

### 3. Search for related vault content

For each confirmed topic:

```bash
qmd vsearch "<topic keywords>" -n 5
```

Note the top 2-3 related existing notes per topic — these will become wiki links.

### 4. Determine folder for each note

Default mapping:
- Personal reflections, life observations, identity → `01_thinking/notes/`
- Business ideas, strategies, growth concepts → `01_thinking/notes/`
- External methods, frameworks, case studies → `02_reference/approaches/`
- Content ideas → `03_creating/pipeline/` (as pipeline posts)

The user can override in their confirmation.

### 5. Generate filenames

- Lowercase, hyphen-separated, English preferred
- Name as **claims or assertions** for thinking notes: `quality-is-the-hard-part.md` not `quality.md`
- Descriptive names for reference notes
- Check that each file doesn't already exist before writing

### 6. Create each note

**Preserve the user's voice and language.** Organize and structure the ideas, but don't sanitize, formalize, or rewrite their words. If they wrote in Spanish, keep it in Spanish. If they mixed languages, keep the mix.

```markdown
# Topic Title

> Source: Personal reflection

## Summary

1-2 paragraph summary of the core idea, in the user's own words as much as possible.

## Key Ideas

### 1. First key idea
- User's point, organized but not rewritten
- **Bold the most important insight**

### 2. Second key idea
- Their observation
- Supporting thought

---

**Related notes:** [[existing-note]], [[other-topic-from-this-dump]], [[vault-note]]
```

### 7. Cross-link all notes from this session

Each note created in this session should link to:
- **Other notes from this same brain dump** (they came from the same thinking session, they're related)
- **Existing vault notes** found via qmd search

Use `[[filename]]` wiki links — filename only, no path, no extension.

### 8. Write all files

Create each note sequentially.

### 9. Index

After all notes are created:

```bash
qmd update && qmd embed
```

### 10. Report

Show a summary:

```
Created X notes from your brain dump:

1. `01_thinking/notes/topic-one.md` — linked to [[existing-note]], [[topic-two]]
2. `02_reference/approaches/topic-two.md` — linked to [[existing-note-2]], [[topic-one]]
3. `01_thinking/notes/topic-three.md` — linked to [[topic-one]], [[topic-two]]

All notes indexed and embedded.
```
