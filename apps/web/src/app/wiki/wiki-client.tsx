"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ListNotesResponse,
  NoteLink,
  NoteRecord,
  NoteRevision,
  NoteWithLinksResponse,
} from "@second-brain/shared";
import {
  Archive,
  BookOpen,
  ChevronRight,
  FilePlus2,
  Folder,
  GitFork,
  History,
  Loader2,
  PanelLeft,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Draft = {
  title: string;
  folder: string;
  body: string;
};

type ViewMode = "edit" | "preview";

type NewNoteDraft = {
  title: string;
  folder: string;
  body: string;
};

export function WikiClient({
  activeTeamId,
  teamName,
  canAdmin,
}: {
  activeTeamId: string;
  teamName: string;
  canAdmin: boolean;
}) {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<NoteRecord | null>(null);
  const [draft, setDraft] = useState<Draft>({ title: "", folder: "", body: "" });
  const [savedDraft, setSavedDraft] = useState<Draft>({
    title: "",
    folder: "",
    body: "",
  });
  const [linksIn, setLinksIn] = useState<NoteLink[]>([]);
  const [linksOut, setLinksOut] = useState<NoteLink[]>([]);
  const [revisions, setRevisions] = useState<NoteRevision[]>([]);
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<string>("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingNote, setLoadingNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newNote, setNewNote] = useState<NewNoteDraft>({
    title: "",
    folder: "00_inbox",
    body: "",
  });

  const dirty =
    draft.title !== savedDraft.title ||
    draft.folder !== savedDraft.folder ||
    draft.body !== savedDraft.body;

  const folders = useMemo(() => {
    const values = new Set(notes.map((note) => note.folder));
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return notes.filter((note) => {
      if (folder !== "all" && note.folder !== folder) return false;
      if (!normalizedQuery) return true;

      return [
        note.title,
        note.slug,
        note.folder,
        note.body,
        ...(note.frontmatter.tags ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [folder, notes, query]);

  useEffect(() => {
    void loadNotes();
  }, [includeArchived]);

  useEffect(() => {
    if (!selectedSlug) {
      setActiveNote(null);
      setDraft({ title: "", folder: "", body: "" });
      setSavedDraft({ title: "", folder: "", body: "" });
      setLinksIn([]);
      setLinksOut([]);
      setRevisions([]);
      return;
    }

    void loadNote(selectedSlug);
  }, [selectedSlug]);

  async function apiFetch(path: string, init: RequestInit = {}) {
    return fetch(path, {
      ...init,
      headers: {
        "x-team-id": activeTeamId,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  }

  async function loadNotes() {
    setLoadingList(true);
    setError(null);

    try {
      const response = await apiFetch(
        `/api/notes?limit=200&include_archived=${includeArchived}`,
      );
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(responseError(payload, "Unable to load notes"));
      }

      const data = payload as ListNotesResponse;
      setNotes(data.notes);

      if (
        data.notes.length > 0 &&
        (!selectedSlug || !data.notes.some((note) => note.slug === selectedSlug))
      ) {
        setSelectedSlug(data.notes[0].slug);
      }

      if (data.notes.length === 0) {
        setSelectedSlug(null);
      }
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoadingList(false);
    }
  }

  async function loadNote(slug: string) {
    setLoadingNote(true);
    setError(null);

    try {
      const response = await apiFetch(
        `/api/notes/${encodeURIComponent(slug)}?include_archived=true`,
      );
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(responseError(payload, "Unable to load note"));
      }

      const data = payload as NoteWithLinksResponse;
      applyActiveNote(data.note);
      setLinksIn(data.links_in);
      setLinksOut(data.links_out);
      setRevisions(data.last_revisions);
      setNotes((current) => upsertNote(current, data.note));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoadingNote(false);
    }
  }

  function applyActiveNote(note: NoteRecord) {
    const nextDraft = {
      title: note.title,
      folder: note.folder,
      body: note.body,
    };

    setActiveNote(note);
    setDraft(nextDraft);
    setSavedDraft(nextDraft);
  }

  function selectNote(slug: string) {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setSelectedSlug(slug);
  }

  async function saveNote() {
    if (!activeNote || !dirty) return;

    setSaving(true);
    setError(null);

    try {
      const response = await apiFetch(
        `/api/notes/${encodeURIComponent(activeNote.slug)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            if_version: activeNote.version,
            title: draft.title,
            folder: draft.folder,
            body: draft.body,
          }),
        },
      );
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(responseError(payload, "Unable to save note"));
      }

      const updated = payload as NoteRecord;
      applyActiveNote(updated);
      setNotes((current) => upsertNote(current, updated));
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function archiveNote() {
    if (!activeNote) return;
    if (!window.confirm(`Archive "${activeNote.title}"?`)) return;

    setSaving(true);
    setError(null);

    try {
      const response = await apiFetch(
        `/api/archive/${encodeURIComponent(activeNote.slug)}`,
        {
          method: "POST",
          body: JSON.stringify({ reason: "Archived from the web wiki" }),
        },
      );
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(responseError(payload, "Unable to archive note"));
      }

      const archived = payload as NoteRecord;
      const nextNotes = includeArchived
        ? upsertNote(notes, archived)
        : notes.filter((note) => note.slug !== archived.slug);

      setNotes(nextNotes);
      const nextSelected = nextNotes[0]?.slug ?? null;
      setSelectedSlug(nextSelected);
    } catch (archiveError) {
      setError(errorMessage(archiveError));
    } finally {
      setSaving(false);
    }
  }

  async function createNote() {
    const title = newNote.title.trim();
    if (!title) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await apiFetch("/api/notes", {
        method: "POST",
        body: JSON.stringify({
          title,
          folder: newNote.folder.trim() || "00_inbox",
          body: newNote.body,
        }),
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(responseError(payload, "Unable to create note"));
      }

      const created = payload as NoteRecord;
      setNotes((current) => upsertNote(current, created));
      setSelectedSlug(created.slug);
      setCreateOpen(false);
      setNewNote({ title: "", folder: "00_inbox", body: "" });
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  const selectedPath = activeNote
    ? `${activeNote.folder}/${activeNote.slug}.md`
    : "No note selected";
  const cardIndex = activeNote
    ? `Note / ${activeNote.slug.slice(0, 6).toUpperCase()}`
    : "Note / —";

  return (
    <main className="relative mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[1440px] grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
      {/* SIDEBAR */}
      <aside className="border-b border-stone-800/70 bg-stone-950/40 backdrop-blur lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col">
          <div className="border-b border-stone-800/70 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-teal-200/80">
                  Remote vault
                </span>
                <h1
                  className="mt-1 truncate font-[family-name:var(--font-fraunces)] text-2xl leading-tight text-stone-100"
                  style={{ fontVariationSettings: "'opsz' 36, 'SOFT' 30" }}
                >
                  {teamName}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                title="Create note"
                aria-label="Create note"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-amber-200/30 bg-amber-200/10 text-amber-200 transition hover:border-amber-200/60 hover:bg-amber-200/20"
              >
                <FilePlus2 className="size-4" aria-hidden />
              </button>
            </div>

            <div className="relative mt-5">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-600"
                aria-hidden
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search notes"
                className="h-10 w-full rounded-md border border-stone-800/80 bg-stone-950/70 pl-9 pr-3 font-[family-name:var(--font-plex-mono)] text-[12px] text-stone-100 placeholder:text-stone-600 outline-none transition focus:border-amber-200/70 focus:ring-1 focus:ring-amber-200/30"
              />
            </div>

            <label className="mt-3 flex select-none items-center gap-2 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.24em] text-stone-500 transition hover:text-stone-300">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
                className="size-3.5 cursor-pointer accent-amber-200"
              />
              Include archived
            </label>
          </div>

          <div className="border-b border-stone-800/70 p-3">
            <FolderButton
              active={folder === "all"}
              onClick={() => setFolder("all")}
              icon={<PanelLeft className="size-3.5" aria-hidden />}
              label="All folders"
              count={notes.length}
            />
            <div className="mt-1 space-y-0.5">
              {folders.map((folderName) => (
                <FolderButton
                  key={folderName}
                  active={folder === folderName}
                  onClick={() => setFolder(folderName)}
                  icon={<Folder className="size-3.5" aria-hidden />}
                  label={folderName}
                  count={notes.filter((note) => note.folder === folderName).length}
                  mono
                />
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-stone-500">
                Notes / {filteredNotes.length}
              </span>
              <button
                type="button"
                onClick={() => void loadNotes()}
                title="Refresh"
                aria-label="Refresh"
                className="inline-flex size-7 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-900/60 hover:text-stone-200"
              >
                <RefreshCw className="size-3.5" aria-hidden />
              </button>
            </div>

            {loadingList ? (
              <div className="flex items-center gap-2 rounded-md border border-dashed border-stone-800/80 bg-stone-950/40 p-3 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.24em] text-stone-500">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Loading notes
              </div>
            ) : filteredNotes.length === 0 ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="w-full rounded-md border border-dashed border-stone-800/80 bg-stone-950/40 p-4 text-left text-sm text-stone-400 transition hover:border-amber-200/40 hover:bg-stone-900/40 hover:text-stone-200"
              >
                <p className="font-[family-name:var(--font-fraunces)] text-base italic text-stone-300">
                  No notes match.
                </p>
                <p className="mt-1 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.24em] text-stone-500">
                  Tap to author the first
                </p>
              </button>
            ) : (
              <ul className="space-y-1">
                {filteredNotes.map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => selectNote(note.slug)}
                      className={cn(
                        "group w-full rounded-md border px-3 py-2 text-left transition-all",
                        selectedSlug === note.slug
                          ? "border-amber-200/40 bg-gradient-to-br from-amber-200/[0.07] via-amber-200/[0.02] to-transparent shadow-[inset_2px_0_0_0_rgba(252,211,77,0.6)]"
                          : "border-transparent hover:border-stone-800 hover:bg-stone-900/60",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen
                          className={cn(
                            "size-3.5 shrink-0",
                            selectedSlug === note.slug
                              ? "text-amber-200/90"
                              : "text-stone-600 group-hover:text-stone-300",
                          )}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate font-[family-name:var(--font-fraunces)] text-[15px] leading-tight",
                            selectedSlug === note.slug
                              ? "text-stone-50"
                              : "text-stone-200",
                          )}
                        >
                          {note.title}
                        </span>
                        {note.archived_at ? (
                          <Archive
                            className="size-3 text-stone-600"
                            aria-hidden
                          />
                        ) : null}
                      </div>
                      <p className="mt-1 truncate pl-5 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.18em] text-stone-500">
                        {note.folder}/{note.slug}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>

      {/* EDITOR */}
      <section className="min-w-0 border-b border-stone-800/70 lg:border-b-0 lg:border-r">
        <div className="flex min-h-full flex-col">
          <div className="border-b border-stone-800/70 bg-stone-950/30 p-5 backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-3 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-stone-500">
                  <span className="text-teal-200/80">{cardIndex}</span>
                  <span className="text-stone-700">/</span>
                  <span className="truncate text-stone-400">{selectedPath}</span>
                  {dirty ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-amber-200">
                      <span className="size-1 rounded-full bg-amber-300 motion-safe:animate-pulse" />
                      Unsaved
                    </span>
                  ) : null}
                  {activeNote?.archived_at ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-stone-700 bg-stone-900/70 px-2 py-0.5 text-stone-300">
                      Archived
                    </span>
                  ) : null}
                </div>
                <h2
                  className="truncate font-[family-name:var(--font-fraunces)] text-[clamp(1.85rem,2.6vw,2.4rem)] leading-[1.05] text-stone-100"
                  style={{ fontVariationSettings: "'opsz' 72, 'SOFT' 30" }}
                >
                  {activeNote?.title ?? (
                    <em className="font-normal italic text-stone-400">
                      Remote wiki
                    </em>
                  )}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-md border border-stone-800/80 bg-stone-950/60 p-0.5 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.24em]">
                  <ViewToggle
                    label="Edit"
                    active={viewMode === "edit"}
                    onClick={() => setViewMode("edit")}
                  />
                  <ViewToggle
                    label="Preview"
                    active={viewMode === "preview"}
                    onClick={() => setViewMode("preview")}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void saveNote()}
                  disabled={!dirty || saving || !activeNote}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-md px-4 text-[13px] font-medium transition-all",
                    "bg-amber-200 text-stone-950 shadow-[0_0_0_1px_rgba(252,211,77,0.35),0_18px_50px_-20px_rgba(252,211,77,0.55)] hover:bg-amber-100",
                    "disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-500 disabled:shadow-none",
                  )}
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Save className="size-3.5" aria-hidden />
                  )}
                  Save
                </button>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}
          </div>

          {activeNote ? (
            <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]">
              <div className="grid gap-4 border-b border-stone-800/70 bg-stone-950/20 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(180px,260px)]">
                <FieldGroup id="note-title" label="Title">
                  <input
                    id="note-title"
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-md border border-stone-800/80 bg-stone-950/70 px-3 font-[family-name:var(--font-fraunces)] text-base text-stone-100 outline-none transition focus:border-amber-200/70 focus:ring-1 focus:ring-amber-200/30"
                  />
                </FieldGroup>
                <FieldGroup id="note-folder" label="Folder">
                  <input
                    id="note-folder"
                    value={draft.folder}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        folder: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-md border border-stone-800/80 bg-stone-950/70 px-3 font-[family-name:var(--font-plex-mono)] text-xs uppercase tracking-[0.18em] text-stone-100 outline-none transition focus:border-amber-200/70 focus:ring-1 focus:ring-amber-200/30"
                  />
                </FieldGroup>
              </div>

              <div className="relative min-h-[560px] overflow-hidden">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.018)_1px,transparent_1px)] [background-size:96px_100%]"
                />
                {loadingNote ? (
                  <div className="relative flex h-full items-center justify-center gap-2 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.28em] text-stone-500">
                    <Loader2
                      className="size-4 animate-spin text-teal-300/80"
                      aria-hidden
                    />
                    Loading note
                  </div>
                ) : viewMode === "edit" ? (
                  <textarea
                    value={draft.body}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    spellCheck={false}
                    className="relative h-full min-h-[560px] w-full resize-none border-0 bg-transparent p-6 font-[family-name:var(--font-plex-mono)] text-[13px] leading-7 text-stone-100 caret-amber-200 outline-none placeholder:text-stone-600"
                    placeholder="# Title&#10;&#10;Write markdown here. Use [[wikilinks]] to connect notes."
                  />
                ) : (
                  <MarkdownPreview body={draft.body} />
                )}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[560px] items-center justify-center p-8">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="group max-w-md rounded-md border border-dashed border-stone-800/80 bg-stone-950/40 p-8 text-left transition-all hover:rotate-0 hover:border-amber-200/40 hover:bg-stone-900/50"
                style={{ transform: "rotate(-0.3deg)" }}
              >
                <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-amber-200/80">
                  Card / empty
                </span>
                <p
                  className="mt-3 font-[family-name:var(--font-fraunces)] text-2xl leading-tight text-stone-100"
                  style={{ fontVariationSettings: "'opsz' 48" }}
                >
                  Author the first{" "}
                  <em className="font-normal italic text-amber-200/95">
                    remote
                  </em>{" "}
                  note.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-stone-400">
                  It will live in the team vault and be available to the web app
                  and every authorized agent.
                </p>
                <span className="mt-5 inline-flex items-center gap-2 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.24em] text-amber-200/90 transition group-hover:gap-3">
                  <FilePlus2 className="size-3.5" aria-hidden />
                  Begin
                </span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* INSPECTOR */}
      <aside className="bg-stone-950/40 backdrop-blur">
        <div className="space-y-6 p-5">
          <section>
            <SectionEyebrow icon={<GitFork className="size-3.5" aria-hidden />}>
              Links
            </SectionEyebrow>
            <LinkList
              title="Out"
              links={linksOut}
              empty="No outgoing links"
              onSelect={selectNote}
            />
            <LinkList
              title="In"
              links={linksIn}
              empty="No backlinks"
              onSelect={selectNote}
            />
          </section>

          <section>
            <SectionEyebrow icon={<History className="size-3.5" aria-hidden />}>
              Recent revisions
            </SectionEyebrow>
            <div className="space-y-2">
              {revisions.length === 0 ? (
                <p className="rounded-md border border-dashed border-stone-800/80 bg-stone-950/40 p-3 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.24em] text-stone-500">
                  No revisions yet
                </p>
              ) : (
                revisions.map((revision) => (
                  <article
                    key={revision.id}
                    className="rounded-md border border-stone-800/80 bg-stone-950/60 p-3 transition hover:border-stone-700"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-teal-300/30 bg-teal-300/10 px-2 py-0.5 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.22em] text-teal-100">
                        {revision.op_type}
                      </span>
                      <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.24em] text-stone-500">
                        v{revision.version}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-stone-200">
                      {revision.summary || "Note changed"}
                    </p>
                    <p className="mt-1 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.24em] text-stone-500">
                      {formatDate(revision.created_at)}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="space-y-2 border-t border-stone-800/70 pt-5">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-10 w-full items-center justify-start gap-2 rounded-md border border-stone-800/80 bg-stone-950/60 px-3 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.24em] text-stone-200 transition hover:border-amber-200/40 hover:bg-stone-900 hover:text-amber-100"
            >
              <FilePlus2 className="size-3.5" aria-hidden />
              New note
            </button>
            <button
              type="button"
              onClick={() => void archiveNote()}
              disabled={!activeNote || Boolean(activeNote.archived_at) || saving}
              className="inline-flex h-10 w-full items-center justify-start gap-2 rounded-md border border-stone-800/80 bg-stone-950/60 px-3 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.24em] text-stone-200 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-stone-800/80 disabled:hover:bg-stone-950/60 disabled:hover:text-stone-200"
            >
              <Archive className="size-3.5" aria-hidden />
              Archive note
            </button>
            {canAdmin ? (
              <p className="pt-2 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase leading-relaxed tracking-[0.22em] text-stone-500">
                Admins manage agents and teammates from the admin pages.
              </p>
            ) : null}
          </section>
        </div>
      </aside>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl border-stone-800/80 bg-stone-950 text-stone-200">
          <DialogHeader>
            <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-amber-200/85">
              Card / new note
            </span>
            <DialogTitle
              className="font-[family-name:var(--font-fraunces)] text-2xl text-stone-100"
              style={{ fontVariationSettings: "'opsz' 48" }}
            >
              Create note
            </DialogTitle>
            <DialogDescription className="text-stone-400">
              Add a markdown note to the team vault. Title and folder reach
              every reader on save.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5">
            <FieldGroup id="new-title" label="Title">
              <input
                id="new-title"
                value={newNote.title}
                onChange={(event) =>
                  setNewNote((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                autoFocus
                className="h-11 w-full rounded-md border border-stone-800/80 bg-stone-950/70 px-3 font-[family-name:var(--font-fraunces)] text-base text-stone-100 outline-none transition focus:border-amber-200/70 focus:ring-1 focus:ring-amber-200/30"
              />
            </FieldGroup>
            <FieldGroup id="new-folder" label="Folder">
              <input
                id="new-folder"
                value={newNote.folder}
                onChange={(event) =>
                  setNewNote((current) => ({
                    ...current,
                    folder: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-md border border-stone-800/80 bg-stone-950/70 px-3 font-[family-name:var(--font-plex-mono)] text-xs uppercase tracking-[0.18em] text-stone-100 outline-none transition focus:border-amber-200/70 focus:ring-1 focus:ring-amber-200/30"
              />
            </FieldGroup>
            <FieldGroup id="new-body" label="Markdown">
              <textarea
                id="new-body"
                value={newNote.body}
                onChange={(event) =>
                  setNewNote((current) => ({
                    ...current,
                    body: event.target.value,
                  }))
                }
                className="h-52 w-full resize-none rounded-md border border-stone-800/80 bg-stone-950/80 p-3 font-[family-name:var(--font-plex-mono)] text-[13px] leading-7 text-stone-100 outline-none transition focus:border-amber-200/70 focus:ring-1 focus:ring-amber-200/30"
                placeholder="# Title&#10;&#10;Note body. Use [[wikilinks]] to connect."
              />
            </FieldGroup>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-700/80 bg-stone-950/60 px-4 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.24em] text-stone-300 transition hover:border-stone-600 hover:text-stone-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void createNote()}
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-amber-200 px-4 text-[13px] font-medium text-stone-950 shadow-[0_0_0_1px_rgba(252,211,77,0.35),0_18px_50px_-20px_rgba(252,211,77,0.55)] transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <FilePlus2 className="size-3.5" aria-hidden />
              )}
              Create
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function FolderButton({
  active,
  onClick,
  icon,
  label,
  count,
  mono = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-all",
        active
          ? "bg-stone-900/80 text-stone-50 shadow-[inset_2px_0_0_0_rgba(94,234,212,0.7)]"
          : "text-stone-400 hover:bg-stone-900/40 hover:text-stone-100",
      )}
    >
      <span
        className={cn(
          active ? "text-teal-200/90" : "text-stone-500",
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[12px]",
          mono
            ? "font-[family-name:var(--font-plex-mono)] uppercase tracking-[0.18em]"
            : "font-[family-name:var(--font-plex-mono)] uppercase tracking-[0.24em]",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-[family-name:var(--font-plex-mono)] text-[10px]",
          active ? "text-stone-300" : "text-stone-600",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ViewToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[0.3rem] px-3 py-1.5 transition-all",
        active
          ? "bg-stone-100 text-stone-950"
          : "text-stone-400 hover:bg-stone-900 hover:text-stone-100",
      )}
    >
      {label}
    </button>
  );
}

function FieldGroup({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.28em] text-stone-400"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionEyebrow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-stone-500">
      <span className="text-teal-200/80">{icon}</span>
      <span>{children}</span>
      <span className="ml-1 h-px flex-1 bg-stone-800/70" />
    </div>
  );
}

function LinkList({
  title,
  links,
  empty,
  onSelect,
}: {
  title: string;
  links: NoteLink[];
  empty: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="mb-5">
      <p className="mb-2 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-stone-500">
        {title}
      </p>
      {links.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-800/80 bg-stone-950/40 p-3 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.22em] text-stone-500">
          {empty}
        </p>
      ) : (
        <ul className="space-y-1">
          {links.map((link) => (
            <li key={`${link.source_slug}-${link.target_slug}`}>
              <button
                type="button"
                onClick={() =>
                  onSelect(title === "In" ? link.source_slug : link.target_slug)
                }
                className="flex w-full items-center gap-2 rounded-md border border-stone-800/80 bg-stone-950/60 px-3 py-2 text-left text-[13px] text-stone-200 transition hover:border-amber-200/40 hover:bg-stone-900/60 hover:text-stone-50"
              >
                <ChevronRight
                  className="size-3 shrink-0 text-stone-500 transition group-hover:text-amber-200"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.2em] text-stone-200">
                  {title === "In" ? link.source_slug : link.target_slug}
                </span>
                {!link.exists ? (
                  <span className="inline-flex items-center rounded-md border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.22em] text-amber-200">
                    missing
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MarkdownPreview({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/);

  return (
    <div className="relative h-full min-h-[560px] overflow-y-auto p-8">
      <article className="mx-auto max-w-3xl space-y-5 text-stone-200">
        {blocks.length === 0 || body.trim() === "" ? (
          <p className="font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.28em] text-stone-500">
            Empty note
          </p>
        ) : (
          blocks.map((block, index) => (
            <MarkdownBlock key={`${index}-${block.slice(0, 12)}`} block={block} />
          ))
        )}
      </article>
    </div>
  );
}

function MarkdownBlock({ block }: { block: string }) {
  if (block.startsWith("# ")) {
    return (
      <h1
        className="font-[family-name:var(--font-fraunces)] text-[2.25rem] leading-[1.05] text-stone-100"
        style={{ fontVariationSettings: "'opsz' 72, 'SOFT' 30" }}
      >
        {block.replace(/^#\s+/, "")}
      </h1>
    );
  }

  if (block.startsWith("## ")) {
    return (
      <h2
        className="border-b border-stone-800/80 pb-3 font-[family-name:var(--font-fraunces)] text-[1.6rem] leading-tight text-stone-100"
        style={{ fontVariationSettings: "'opsz' 48" }}
      >
        {block.replace(/^##\s+/, "")}
      </h2>
    );
  }

  if (block.startsWith("### ")) {
    return (
      <h3
        className="font-[family-name:var(--font-fraunces)] text-[1.2rem] text-stone-100"
        style={{ fontVariationSettings: "'opsz' 36" }}
      >
        {block.replace(/^###\s+/, "")}
      </h3>
    );
  }

  if (/^[-*]\s+/m.test(block)) {
    return (
      <ul className="space-y-2 pl-5 text-[14px] leading-7">
        {block.split("\n").map((line) => (
          <li key={line} className="list-disc marker:text-teal-200/70">
            <InlineMarkdown text={line.replace(/^[-*]\s+/, "")} />
          </li>
        ))}
      </ul>
    );
  }

  if (block.startsWith("```")) {
    return (
      <pre className="overflow-x-auto rounded-md border border-stone-800/80 bg-stone-950/70 p-4 font-[family-name:var(--font-plex-mono)] text-[12px] leading-6 text-stone-200">
        {block.replace(/^```\w*\n?/, "").replace(/```$/, "")}
      </pre>
    );
  }

  return (
    <p className="text-[14px] leading-7 text-stone-300">
      <InlineMarkdown text={block.replace(/\n/g, " ")} />
    </p>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\[\[[^\]]+\]\])/g);

  return (
    <>
      {parts.map((part, index) => {
        const wikiMatch = /^\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/.exec(part);
        if (!wikiMatch) return <span key={`${part}-${index}`}>{part}</span>;

        return (
          <span
            key={`${part}-${index}`}
            className="rounded border border-amber-200/30 bg-amber-200/10 px-1.5 py-0.5 font-[family-name:var(--font-plex-mono)] text-[12px] uppercase tracking-[0.16em] text-amber-100"
          >
            {wikiMatch[1]}
          </span>
        );
      })}
    </>
  );
}

function upsertNote(notes: NoteRecord[], note: NoteRecord): NoteRecord[] {
  const next = notes.filter((current) => current.id !== note.id);
  next.push(note);
  return next.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function responseError(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
