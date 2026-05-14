import "server-only";

import {
  type ArchiveNoteRequest,
  type CreateNoteRequest,
  type NoteRecord,
  type NoteRevision,
  type PatchNoteRequest,
} from "@second-brain/shared";

import { jsonError } from "@/lib/api/responses";
import { withTeamContext } from "@/lib/db/withTeamContext";
import type { PoolClient } from "@/lib/db/pool";
import { insertWikiLink, normalizeFolder, normalizeSlug, slugifyTitle } from "@/lib/notes/markdown";
import { canWrite, type PolicyPrincipal } from "@/lib/policy";

export type NotesPrincipal = PolicyPrincipal;

type DbNoteRow = NoteRecord & {
  team_id: string;
  archived_original_folder: string | null;
};

type DbRevisionRow = NoteRevision & {
  team_id: string;
};

export type NotesError = {
  status: number;
  body: Record<string, unknown>;
  headers?: HeadersInit;
};

export type NotesResult<T> = { ok: true; value: T; headers?: HeadersInit } | { ok: false; error: NotesError };

export type NoteRead = {
  note: NoteRecord;
  links_in: NoteLinkResult[];
  links_out: NoteLinkResult[];
  last_revisions: NoteRevision[];
};

export type NoteLinkResult = {
  source_slug: string;
  target_slug: string;
  exists: boolean;
};

export type RevisionList = {
  revisions: NoteRevision[];
  next_before: string | null;
};

export type NotesList = {
  notes: NoteRecord[];
  next_updated_before: string | null;
};

export async function listNotes(
  principal: NotesPrincipal,
  {
    includeArchived,
    folder,
    q,
    updatedBefore,
    limit,
  }: {
    includeArchived: boolean;
    folder?: string | null;
    q?: string | null;
    updatedBefore?: string | null;
    limit: number;
  },
): Promise<NotesResult<NotesList>> {
  return withPrincipalTeam(principal, async (client) => {
    const boundedLimit = Math.min(Math.max(limit, 1), 200);
    const result = await client.query<DbNoteRow>(
      `select *
         from public.notes
        where team_id = $1
          and ($2::boolean or archived_at is null)
          and ($3::text is null or folder = $3)
          and ($4::text is null or updated_at < $4::timestamptz)
          and (
            $5::text is null
            or slug::text ilike '%' || $5 || '%'
            or title ilike '%' || $5 || '%'
            or body ilike '%' || $5 || '%'
          )
        order by updated_at desc, id desc
        limit $6`,
      [
        principal.team_id,
        includeArchived,
        folder?.trim() || null,
        updatedBefore ?? null,
        q?.trim() || null,
        boundedLimit,
      ],
    );

    return ok({
      notes: result.rows.map(toNoteRecord),
      next_updated_before:
        result.rows.length === boundedLimit
          ? toNoteRecord(result.rows[result.rows.length - 1]).updated_at
          : null,
    });
  });
}

export async function getNote(
  principal: NotesPrincipal,
  slug: string,
  includeArchived: boolean,
): Promise<NotesResult<NoteRead>> {
  return withPrincipalTeam(principal, async (client) => {
    const note = await findNote(client, principal.team_id, slug);
    if (!note) return err(404, "Note not found");
    if (note.archived_at && !includeArchived) return err(410, "Note archived");

    const linksIn = await loadLinksIn(client, principal.team_id, note.slug);
    const linksOut = await loadLinksOut(client, principal.team_id, note.id);
    const revisions = await loadRevisions(client, note.id, { limit: 3, full: false });

    return ok(
      {
        note: toNoteRecord(note),
        links_in: linksIn,
        links_out: linksOut,
        last_revisions: revisions,
      },
      etagHeaders(note),
    );
  });
}

export async function listRevisions(
  principal: NotesPrincipal,
  slug: string,
  {
    before,
    full,
    limit,
  }: {
    before?: string | null;
    full: boolean;
    limit: number;
  },
): Promise<NotesResult<RevisionList>> {
  if (full && !isAdminOrOwner(principal)) {
    return err(403, "Full revision bodies require admin access");
  }

  return withPrincipalTeam(principal, async (client) => {
    const note = await findNote(client, principal.team_id, slug);
    if (!note) return err(404, "Note not found");

    const revisions = await loadRevisions(client, note.id, {
      before,
      full,
      limit: Math.min(Math.max(limit, 1), 100),
    });
    const nextBefore =
      revisions.length === Math.min(Math.max(limit, 1), 100)
        ? revisions[revisions.length - 1]?.created_at ?? null
        : null;

    return ok({ revisions, next_before: nextBefore });
  });
}

export async function createNote(
  principal: NotesPrincipal,
  request: CreateNoteRequest,
): Promise<NotesResult<NoteRecord>> {
  const now = new Date().toISOString();
  const folder = normalizeFolder(request.folder);
  const baseSlug = normalizeSlug(request.slug || request.title);
  const frontmatter = {
    ...request.frontmatter,
    created_by: request.frontmatter.created_by || principal.id,
    created_at: request.frontmatter.created_at || now,
  };

  const policy = canWrite(principal, "create", {
    folder,
    slug: baseSlug,
    frontmatter,
  });
  if (!policy.allowed) return policyErr(policy);

  return withPrincipalTeam(principal, async (client) => {
    const slug = await uniqueSlug(client, principal.team_id, baseSlug);
    if (request.slug && slug !== baseSlug) {
      return {
        ok: false,
        error: {
          status: 409,
          body: {
            error: "Slug already exists",
            suggested_slug: slug,
          },
        },
      };
    }

    await setNoteAudit(client, principal, "create", "create note");
    const result = await client.query<DbNoteRow>(
      `insert into public.notes (
        team_id,
        slug,
        folder,
        title,
        body,
        frontmatter,
        created_by,
        created_by_type,
        updated_by,
        updated_by_type
      ) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $7, $8)
      returning *`,
      [
        principal.team_id,
        slug,
        folder,
        request.title.trim(),
        request.body,
        JSON.stringify(frontmatter),
        principal.id,
        principal.kind,
      ],
    );

    return ok(toNoteRecord(result.rows[0]));
  });
}

export async function patchNote(
  principal: NotesPrincipal,
  slug: string,
  request: PatchNoteRequest,
): Promise<NotesResult<NoteRecord>> {
  return withPrincipalTeam(principal, async (client) => {
    const current = await findNote(client, principal.team_id, slug);
    if (!current) return err(404, "Note not found");
    if (current.archived_at) return err(410, "Note archived");

    const nextFolder = request.folder ? normalizeFolder(request.folder) : current.folder;
    const nextFrontmatter = {
      ...current.frontmatter,
      ...(request.frontmatter_patch ?? {}),
    };
    const policy = canWrite(principal, "edit", {
      folder: nextFolder,
      slug: current.slug,
      frontmatter: nextFrontmatter,
    });
    if (!policy.allowed) return policyErr(policy);

    if (current.version !== request.if_version) {
      return conflict(current);
    }

    await setNoteAudit(client, principal, "edit", "edit note");
    const result = await client.query<DbNoteRow>(
      `update public.notes
          set body = coalesce($4, body),
              title = coalesce($5, title),
              folder = coalesce($6, folder),
              frontmatter = $7::jsonb
        where id = $1
          and team_id = $2
          and version = $3
        returning *`,
      [
        current.id,
        principal.team_id,
        request.if_version,
        request.body ?? null,
        request.title?.trim() || null,
        request.folder ? nextFolder : null,
        JSON.stringify(nextFrontmatter),
      ],
    );

    const updated = result.rows[0];
    if (!updated) {
      const fresh = await findNote(client, principal.team_id, slug);
      return conflict(fresh ?? current);
    }

    return ok(toNoteRecord(updated), etagHeaders(updated));
  });
}

export async function appendNote(
  principal: NotesPrincipal,
  slug: string,
  request: { section: string; text: string; wiki_links?: string[] },
): Promise<NotesResult<NoteRecord>> {
  return withPrincipalTeam(principal, async (client) => {
    const note = await findNote(client, principal.team_id, slug);
    if (!note) return err(404, "Note not found");
    if (note.archived_at) return err(410, "Note archived");

    const policy = canWrite(principal, "append", {
      folder: note.folder,
      slug: note.slug,
      frontmatter: note.frontmatter,
    });
    if (!policy.allowed) return policyErr(policy);

    const allowedSections = new Set([
      "breadcrumbs",
      "open_questions",
      "key_notes",
      "sources",
      ...(Array.isArray(note.frontmatter.append_sections)
        ? note.frontmatter.append_sections.filter((section) => typeof section === "string")
        : []),
    ]);
    if (!allowedSections.has(request.section)) {
      return err(400, "Append section is not allowed", {
        allowed_sections: [...allowedSections],
      });
    }

    await client.query(
      `insert into public.moc_appends (
        team_id,
        note_id,
        section,
        text,
        wiki_links,
        appended_by,
        appended_by_type
      ) values ($1, $2, $3, $4, $5::citext[], $6, $7)`,
      [
        principal.team_id,
        note.id,
        request.section,
        request.text,
        request.wiki_links ?? [],
        principal.id,
        principal.kind,
      ],
    );

    const updated = await findNoteById(client, note.id);
    return ok(toNoteRecord(updated ?? note), updated ? etagHeaders(updated) : undefined);
  });
}

export async function linkNote(
  principal: NotesPrincipal,
  slug: string,
  request: { target_slug: string; context_phrase?: string },
): Promise<NotesResult<{ note: NoteRecord; changed: boolean }>> {
  return withPrincipalTeam<{ note: NoteRecord; changed: boolean }>(principal, async (client) => {
    const note = await findNote(client, principal.team_id, slug);
    if (!note) return err(404, "Note not found");
    if (note.archived_at) return err(410, "Note archived");

    const policy = canWrite(principal, "link", {
      folder: note.folder,
      slug: note.slug,
      frontmatter: note.frontmatter,
    });
    if (!policy.allowed) return policyErr(policy);

    const inserted = insertWikiLink(note.body, request.target_slug, request.context_phrase);
    if (!inserted.changed) {
      return ok({ note: toNoteRecord(note), changed: false }, etagHeaders(note));
    }

    await setNoteAudit(client, principal, "link", `link to ${request.target_slug}`);
    const result = await client.query<DbNoteRow>(
      `update public.notes
          set body = $1
        where id = $2
          and team_id = $3
          and version = $4
        returning *`,
      [inserted.body, note.id, principal.team_id, note.version],
    );

    const updated = result.rows[0];
    if (!updated) {
      const fresh = await findNote(client, principal.team_id, slug);
      return conflict(fresh ?? note);
    }

    return ok({ note: toNoteRecord(updated), changed: true }, etagHeaders(updated));
  });
}

export async function archiveNote(
  principal: NotesPrincipal,
  slug: string,
  request: ArchiveNoteRequest,
): Promise<NotesResult<NoteRecord>> {
  return withPrincipalTeam(principal, async (client) => {
    const note = await findNote(client, principal.team_id, slug);
    if (!note) return err(404, "Note not found");
    if (note.archived_at) return ok(toNoteRecord(note), etagHeaders(note));

    const policy = canWrite(principal, "archive", {
      folder: note.folder,
      slug: note.slug,
      frontmatter: note.frontmatter,
    });
    if (!policy.allowed) return policyErr(policy);

    await setNoteAudit(client, principal, "archive", request.reason);
    const result = await client.query<DbNoteRow>(
      `update public.notes
          set archived_at = now(),
              archived_reason = $1,
              archived_original_folder = folder,
              folder = $2
        where id = $3
          and team_id = $4
        returning *`,
      [request.reason, `05_archive/${note.folder}`, note.id, principal.team_id],
    );

    return ok(toNoteRecord(result.rows[0]), etagHeaders(result.rows[0]));
  });
}

export async function restoreNote(
  principal: NotesPrincipal,
  slug: string,
): Promise<NotesResult<NoteRecord>> {
  if (!isAdminOrOwner(principal)) {
    return err(403, "Restore requires admin access");
  }

  return withPrincipalTeam(principal, async (client) => {
    const note = await findNote(client, principal.team_id, slug);
    if (!note) return err(404, "Note not found");
    if (!note.archived_at) return ok(toNoteRecord(note), etagHeaders(note));

    await setNoteAudit(client, principal, "restore", "restore note");
    const result = await client.query<DbNoteRow>(
      `update public.notes
          set archived_at = null,
              archived_reason = null,
              folder = coalesce(archived_original_folder, regexp_replace(folder, '^05_archive/', '')),
              archived_original_folder = null
        where id = $1
          and team_id = $2
        returning *`,
      [note.id, principal.team_id],
    );

    return ok(toNoteRecord(result.rows[0]), etagHeaders(result.rows[0]));
  });
}

export function resultResponse<T>(
  result: NotesResult<T>,
  body: (value: T) => Response,
): Response {
  if (!result.ok) {
    return Response.json(result.error.body, {
      status: result.error.status,
      headers: result.error.headers,
    });
  }

  return body(result.value);
}

export function noteErrorResponse(result: NotesResult<unknown>): Response | null {
  if (result.ok) return null;

  return jsonError(String(result.error.body.error ?? "Request failed"), result.error.status);
}

async function withPrincipalTeam<T>(
  principal: NotesPrincipal,
  callback: (client: PoolClient) => Promise<NotesResult<T>>,
): Promise<NotesResult<T>> {
  try {
    return await withTeamContext(principal.team_id, callback, {
      trusted: principal.kind === "agent",
      userId: principal.kind === "human" ? principal.id : undefined,
    });
  } catch (error) {
    console.error("Notes API database error", error);
    return err(500, "Unable to process notes request");
  }
}

async function findNote(
  client: PoolClient,
  teamId: string,
  slug: string,
): Promise<DbNoteRow | null> {
  const result = await client.query<DbNoteRow>(
    `select *
       from public.notes
      where team_id = $1
        and slug = $2
      limit 1`,
    [teamId, normalizeSlug(slug)],
  );
  return result.rows[0] ?? null;
}

async function findNoteById(client: PoolClient, id: string): Promise<DbNoteRow | null> {
  const result = await client.query<DbNoteRow>(
    "select * from public.notes where id = $1 limit 1",
    [id],
  );
  return result.rows[0] ?? null;
}

async function uniqueSlug(
  client: PoolClient,
  teamId: string,
  baseSlug: string,
): Promise<string> {
  const normalized = slugifyTitle(baseSlug);
  const result = await client.query<{ slug: string }>(
    `select slug::text as slug
       from public.notes
      where team_id = $1
        and (slug::text = $2 or slug::text like $3)
      order by slug::text`,
    [teamId, normalized, `${normalized}-%`],
  );
  const existing = new Set(result.rows.map((row) => row.slug));
  if (!existing.has(normalized)) return normalized;

  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${normalized}-${index}`;
    if (!existing.has(candidate)) return candidate;
  }

  throw new Error("Unable to generate unique slug");
}

async function loadRevisions(
  client: PoolClient,
  noteId: string,
  {
    before,
    full,
    limit,
  }: {
    before?: string | null;
    full: boolean;
    limit: number;
  },
): Promise<NoteRevision[]> {
  const result = await client.query<DbRevisionRow>(
    `select
        id,
        team_id,
        note_id,
        version,
        op_type,
        author_id,
        author_type,
        ${full ? "before_body" : "null::text as before_body"},
        ${full ? "after_body" : "null::text as after_body"},
        summary,
        diff_preview,
        created_at
       from public.note_revisions
      where note_id = $1
        and ($2::timestamptz is null or created_at < $2::timestamptz)
      order by created_at desc, id desc
      limit $3`,
    [noteId, before ?? null, limit],
  );

  return result.rows.map(toRevisionRecord);
}

async function loadLinksOut(
  client: PoolClient,
  teamId: string,
  noteId: string,
): Promise<NoteLinkResult[]> {
  const result = await client.query<NoteLinkResult>(
    `select
        source.slug::text as source_slug,
        links.target_slug::text as target_slug,
        target.id is not null as exists
       from public.note_links links
       join public.notes source on source.id = links.source_id
       left join public.notes target
         on target.team_id = links.team_id
        and target.slug = links.target_slug
      where links.team_id = $1
        and links.source_id = $2
      order by links.target_slug::text`,
    [teamId, noteId],
  );
  return result.rows;
}

async function loadLinksIn(
  client: PoolClient,
  teamId: string,
  slug: string,
): Promise<NoteLinkResult[]> {
  const result = await client.query<NoteLinkResult>(
    `select
        source.slug::text as source_slug,
        links.target_slug::text as target_slug,
        target.id is not null as exists
       from public.note_links links
       join public.notes source on source.id = links.source_id
       left join public.notes target
         on target.team_id = links.team_id
        and target.slug = links.target_slug
      where links.team_id = $1
        and links.target_slug = $2
      order by source.slug::text`,
    [teamId, normalizeSlug(slug)],
  );
  return result.rows;
}

async function setNoteAudit(
  client: PoolClient,
  principal: NotesPrincipal,
  op: string,
  summary: string,
): Promise<void> {
  await client.query(
    `select
       set_config('app.note_author_id', $1, true),
       set_config('app.note_author_type', $2, true),
       set_config('app.note_op_type', $3, true),
       set_config('app.note_summary', $4, true)`,
    [principal.id, principal.kind, op, summary],
  );
}

function toNoteRecord(row: DbNoteRow | undefined): NoteRecord {
  if (!row) throw new Error("Expected note row");
  return {
    id: row.id,
    slug: String(row.slug),
    folder: row.folder,
    title: row.title,
    body: row.body,
    frontmatter: row.frontmatter,
    version: row.version,
    created_by: row.created_by,
    created_by_type: row.created_by_type,
    updated_by: row.updated_by,
    updated_by_type: row.updated_by_type,
    archived_at: row.archived_at,
    archived_reason: row.archived_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toRevisionRecord(row: DbRevisionRow): NoteRevision {
  return {
    id: row.id,
    note_id: row.note_id,
    version: row.version,
    op_type: row.op_type,
    author_id: row.author_id,
    author_type: row.author_type,
    before_body: row.before_body,
    after_body: row.after_body,
    summary: row.summary,
    diff_preview: row.diff_preview,
    created_at: row.created_at,
  };
}

function etagHeaders(note: Pick<DbNoteRow, "slug" | "version">): HeadersInit {
  return { ETag: `"${String(note.slug)}:${note.version}"` };
}

function ok<T>(value: T, headers?: HeadersInit): NotesResult<T> {
  return { ok: true, value, headers };
}

function err(
  status: number,
  message: string,
  extra: Record<string, unknown> = {},
): NotesResult<never> {
  return {
    ok: false,
    error: {
      status,
      body: {
        error: message,
        ...extra,
      },
    },
  };
}

function policyErr(policy: Exclude<ReturnType<typeof canWrite>, { allowed: true }>): NotesResult<never> {
  return err(policy.code === "frontmatter_invalid" ? 400 : 403, policy.reason, {
    code: policy.code,
    ...(policy.hint ? { hint: policy.hint } : {}),
  });
}

function conflict(note: DbNoteRow): NotesResult<never> {
  return err(409, "Version conflict", {
    current_version: note.version,
    diff_hint: note.body.slice(0, 200),
  });
}

function isAdminOrOwner(principal: NotesPrincipal): boolean {
  return principal.kind === "human" && ["admin", "owner"].includes(principal.role);
}
