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
