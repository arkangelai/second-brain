import picomatch from "picomatch";
import { z } from "zod";

export const AgentScopeOperationSchema = z.enum([
  "search",
  "get",
  "create",
  "edit",
  "append",
  "link",
  "ingest",
  "archive",
]);
export type AgentScopeOperation = z.infer<typeof AgentScopeOperationSchema>;

export const AgentScopesSchema = z
  .object({
    read_paths: z.array(z.string().min(1)).default(["**/*"]),
    write_paths: z.array(z.string().min(1)).default([]),
    append_paths: z.array(z.string().min(1)).default([]),
    ops: z.array(AgentScopeOperationSchema).default(["search", "get"]),
    ingestion: z
      .object({
        urls: z.boolean().default(false),
        files: z.boolean().default(false),
      })
      .default({ urls: false, files: false }),
    max_writes_per_hour: z.number().int().min(0).max(10_000).default(0),
  })
  .strict();
export type AgentScopes = z.infer<typeof AgentScopesSchema>;

export const ScopeTemplateNameSchema = z.enum([
  "reader",
  "writer",
  "researcher",
  "custom",
]);
export type ScopeTemplateName = z.infer<typeof ScopeTemplateNameSchema>;

const defaultReadPaths = ["**/*"];
const writablePaths = [
  "01_thinking/notes/**",
  "02_reference/sources/**",
  "03_creating/drafts/**",
  "00_inbox/**",
];
const appendPaths = ["01_thinking/**/*.md"];
const readOps: AgentScopeOperation[] = ["search", "get"];
const writeOps: AgentScopeOperation[] = [
  "search",
  "get",
  "create",
  "append",
  "link",
];
const noIngestion = { urls: false, files: false };

export const scopeTemplates = {
  reader: {
    read_paths: [...defaultReadPaths],
    write_paths: [],
    append_paths: [],
    ops: [...readOps],
    ingestion: { ...noIngestion },
    max_writes_per_hour: 0,
  },
  writer: {
    read_paths: [...defaultReadPaths],
    write_paths: [...writablePaths],
    append_paths: [...appendPaths],
    ops: [...writeOps],
    ingestion: { ...noIngestion },
    max_writes_per_hour: 500,
  },
  researcher: {
    read_paths: [...defaultReadPaths],
    write_paths: [...writablePaths],
    append_paths: [...appendPaths],
    ops: [...writeOps, "ingest"],
    ingestion: { urls: true, files: true },
    max_writes_per_hour: 500,
  },
  custom: {
    read_paths: [...defaultReadPaths],
    write_paths: [...writablePaths],
    append_paths: [...appendPaths],
    ops: [...writeOps],
    ingestion: { ...noIngestion },
    max_writes_per_hour: 500,
  },
} satisfies Record<ScopeTemplateName, AgentScopes>;

export function parseAgentScopes(value: unknown): AgentScopes {
  return AgentScopesSchema.parse(value);
}

export function summarizeAgentScopes(scopes: AgentScopes): string {
  if (scopes.ops.length === 0) return "No operations";

  const writeCount = scopes.write_paths.length;
  const appendCount = scopes.append_paths.length;
  const parts = [scopes.ops.join(", ")];

  if (writeCount > 0) parts.push(`${writeCount} write path${writeCount === 1 ? "" : "s"}`);
  if (appendCount > 0) parts.push(`${appendCount} append path${appendCount === 1 ? "" : "s"}`);

  return parts.join(" · ");
}

// Maps each operation to the path bucket whose globs gate it.
//
// `append` is special: it's allowed when the path matches `append_paths` *or*
// `write_paths` (a writer scope can append anywhere it can write, but an
// append-only scope is limited to its append bucket).
const opPathBucket: Record<
  AgentScopeOperation,
  "read_paths" | "write_paths" | "append_paths"
> = {
  search: "read_paths",
  get: "read_paths",
  create: "write_paths",
  edit: "write_paths",
  append: "append_paths",
  link: "write_paths",
  ingest: "write_paths",
  archive: "write_paths",
};

export type ScopeMatch =
  | { allowed: true }
  | { allowed: false; reason: "op_not_allowed" | "path_not_allowed" };

// Returns whether the agent may perform `op` on `path` under `scopes`.
// Path matching uses picomatch globs (e.g. `01_thinking/notes/**`).
// Path comparison is case-sensitive and treats `/` as the separator.
export function matchScope(
  scopes: AgentScopes,
  path: string,
  op: AgentScopeOperation
): ScopeMatch {
  if (!scopes.ops.includes(op)) {
    return { allowed: false, reason: "op_not_allowed" };
  }

  const normalized = normalizePath(path);
  const bucket = opPathBucket[op];
  const primary = scopes[bucket];

  if (matchesAny(primary, normalized)) return { allowed: true };

  // Allow append when the path is inside the agent's write paths too —
  // a writer scope shouldn't have to redeclare write paths as append paths.
  if (op === "append" && matchesAny(scopes.write_paths, normalized)) {
    return { allowed: true };
  }

  return { allowed: false, reason: "path_not_allowed" };
}

function matchesAny(globs: string[], path: string): boolean {
  if (globs.length === 0) return false;
  return picomatch.isMatch(path, globs, { dot: true });
}

function normalizePath(path: string): string {
  return path.replace(/^\.?\/+/, "").replace(/\\/g, "/");
}
