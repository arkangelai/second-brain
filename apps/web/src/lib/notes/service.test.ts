import { beforeEach, describe, expect, it, mock } from "bun:test";

import { scopeTemplates, type AgentScopes } from "@second-brain/shared";

mock.module("server-only", () => ({}));

type QueryResult = { rows: Record<string, unknown>[] };
type QueryHandler = (sql: string, values: unknown[]) => Promise<QueryResult>;

let queryHandler: QueryHandler;

mock.module("@/lib/db/withTeamContext", () => ({
  withTeamContext: async (
    _teamId: string,
    callback: (client: {
      query: (sql: string, values?: unknown[]) => Promise<QueryResult>;
    }) => Promise<unknown>,
  ) =>
    callback({
      query: (sql: string, values: unknown[] = []) => queryHandler(sql, values),
    }),
}));

const { createNote, getNote, listNotes, listRevisions } = await import("./service");

const teamId = "00000000-0000-0000-0000-0000000000aa";
const principalId = "00000000-0000-0000-0000-000000000001";
const timestamp = "2026-05-14T00:00:00.000Z";

const humanPrincipal = {
  kind: "human" as const,
  id: principalId,
  team_id: teamId,
  role: "member" as const,
};

function agentPrincipal(scopes: AgentScopes = scopeTemplates.reader) {
  return {
    kind: "agent" as const,
    id: "00000000-0000-0000-0000-000000000002",
    team_id: teamId,
    role: "member" as const,
    scopes,
  };
}

function noteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000010",
    team_id: teamId,
    slug: "race",
    folder: "06_system/private",
    title: "Race",
    body: "body",
    frontmatter: {
      created_by: principalId,
      created_at: timestamp,
    },
    version: 1,
    created_by: principalId,
    created_by_type: "human",
    updated_by: principalId,
    updated_by_type: "human",
    archived_at: null,
    archived_reason: null,
    archived_original_folder: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

function revisionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000020",
    team_id: teamId,
    note_id: "00000000-0000-0000-0000-000000000010",
    version: 1,
    op_type: "edit",
    author_id: principalId,
    author_type: "human",
    before_body: null,
    after_body: null,
    summary: null,
    diff_preview: null,
    created_at: timestamp,
    ...overrides,
  };
}

describe("notes service read policy", () => {
  beforeEach(() => {
    queryHandler = async () => ({ rows: [] });
  });

  it("denies getNote before loading note content details outside agent read_paths", async () => {
    const queries: string[] = [];
    queryHandler = async (sql) => {
      queries.push(sql);
      if (sql.includes("from public.notes")) return { rows: [noteRow()] };
      throw new Error(`Unexpected query: ${sql}`);
    };

    const result = await getNote(
      agentPrincipal({
        ...scopeTemplates.reader,
        read_paths: ["01_thinking/notes/**"],
      }),
      "race",
      false,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(403);
      expect(result.error.body.code).toBe("path_not_allowed");
    }
    expect(queries).toHaveLength(1);
  });

  it("denies listRevisions outside agent read_paths before loading revisions", async () => {
    const queries: string[] = [];
    queryHandler = async (sql) => {
      queries.push(sql);
      if (sql.includes("from public.notes")) return { rows: [noteRow()] };
      throw new Error(`Unexpected query: ${sql}`);
    };

    const result = await listRevisions(
      agentPrincipal({
        ...scopeTemplates.reader,
        read_paths: ["01_thinking/notes/**"],
      }),
      "race",
      { full: false, limit: 10 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(403);
      expect(result.error.body.code).toBe("path_not_allowed");
    }
    expect(queries).toHaveLength(1);
  });

  it("filters listNotes results outside agent read_paths", async () => {
    queryHandler = async (sql) => {
      if (sql.includes("from public.notes")) {
        return {
          rows: [
            noteRow({
              slug: "visible",
              folder: "01_thinking/notes",
              title: "Visible",
            }),
            noteRow({
              slug: "hidden",
              folder: "06_system/private",
              title: "Hidden",
            }),
          ],
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    };

    const result = await listNotes(
      agentPrincipal({
        ...scopeTemplates.reader,
        read_paths: ["01_thinking/notes/**"],
      }),
      { includeArchived: false, limit: 10 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.notes.map((note) => note.slug)).toEqual(["visible"]);
    }
  });

  it("uses the id tie-breaker for listNotes keyset pagination", async () => {
    const beforeId = "00000000-0000-0000-0000-000000000099";
    const nextId = "00000000-0000-0000-0000-000000000011";
    queryHandler = async (sql, values) => {
      if (sql.includes("from public.notes")) {
        expect(sql).toContain("updated_at = $4::timestamptz");
        expect(sql).toContain("id < $5::uuid");
        expect(values[3]).toBe(timestamp);
        expect(values[4]).toBe(beforeId);
        return {
          rows: [
            noteRow({ id: "00000000-0000-0000-0000-000000000012", slug: "newer" }),
            noteRow({ id: nextId, slug: "cursor" }),
          ],
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    };

    const result = await listNotes(humanPrincipal, {
      includeArchived: false,
      updatedBefore: timestamp,
      updatedBeforeId: beforeId,
      limit: 2,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.next_updated_before).toBe(timestamp);
      expect(result.value.next_updated_before_id).toBe(nextId);
    }
  });

  it("uses the id tie-breaker for listRevisions keyset pagination", async () => {
    const beforeId = "00000000-0000-0000-0000-000000000099";
    const nextId = "00000000-0000-0000-0000-000000000020";
    queryHandler = async (sql, values) => {
      if (sql.includes("from public.notes")) {
        return { rows: [noteRow({ folder: "01_thinking/notes" })] };
      }

      if (sql.includes("from public.note_revisions")) {
        expect(sql).toContain("created_at = $2::timestamptz");
        expect(sql).toContain("id < $3::uuid");
        expect(values[1]).toBe(timestamp);
        expect(values[2]).toBe(beforeId);
        return { rows: [revisionRow({ id: nextId })] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    };

    const result = await listRevisions(humanPrincipal, "race", {
      before: timestamp,
      beforeId,
      full: false,
      limit: 1,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.next_before).toBe(timestamp);
      expect(result.value.next_before_id).toBe(nextId);
    }
  });
});

describe("notes service slug races", () => {
  beforeEach(() => {
    queryHandler = async () => ({ rows: [] });
  });

  it("retries generated slugs when a concurrent insert wins the first candidate", async () => {
    let slugLookups = 0;
    let inserts = 0;
    queryHandler = async (sql) => {
      if (sql.includes("select slug::text as slug")) {
        slugLookups += 1;
        return { rows: slugLookups === 1 ? [] : [{ slug: "race" }] };
      }

      if (sql.includes("set_config('app.note_author_id'")) {
        return { rows: [] };
      }

      if (sql.includes("insert into public.notes")) {
        inserts += 1;
        expect(sql).toContain("on conflict (team_id, slug) do nothing");
        return { rows: inserts === 1 ? [] : [noteRow({ slug: "race-2" })] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    };

    const result = await createNote(humanPrincipal, {
      title: "Race",
      body: "body",
      frontmatter: {},
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.slug).toBe("race-2");
    expect(inserts).toBe(2);
  });

  it("returns a conflict for explicit slug races instead of throwing", async () => {
    let slugLookups = 0;
    let inserts = 0;
    queryHandler = async (sql) => {
      if (sql.includes("select slug::text as slug")) {
        slugLookups += 1;
        return { rows: slugLookups === 1 ? [] : [{ slug: "race" }] };
      }

      if (sql.includes("set_config('app.note_author_id'")) {
        return { rows: [] };
      }

      if (sql.includes("insert into public.notes")) {
        inserts += 1;
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    };

    const result = await createNote(humanPrincipal, {
      slug: "race",
      title: "Race",
      body: "body",
      frontmatter: {},
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(409);
      expect(result.error.body.suggested_slug).toBe("race-2");
    }
    expect(inserts).toBe(1);
  });
});
