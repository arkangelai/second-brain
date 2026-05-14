import {
  matchScope,
  type AgentScopeOperation,
  type AgentScopes,
  type NoteFrontmatter,
} from "@second-brain/shared";

export type PolicyOperation =
  | "create"
  | "edit"
  | "append"
  | "link"
  | "archive"
  | "ingest"
  | "delete";

export type PolicyPrincipal =
  | {
      kind: "human";
      id: string;
      team_id: string;
      role: "owner" | "admin" | "member";
    }
  | {
      kind: "agent";
      id: string;
      team_id: string;
      role: "admin" | "member";
      scopes: AgentScopes;
    };

export type PolicyTarget = {
  folder: string;
  slug?: string;
  frontmatter?: Partial<NoteFrontmatter> | Record<string, unknown>;
};

export type PolicyDecision =
  | { allowed: true }
  | {
      allowed: false;
      code:
        | "delete_forbidden"
        | "locked_path"
        | "frontmatter_invalid"
        | "op_not_allowed"
        | "path_not_allowed";
      reason: string;
      hint?: string;
    };

const lockedExactPaths = new Set([
  "06_system/content-engine/voice-profile.md",
  "06_system/content-engine/learnings.md",
]);

export function canWrite(
  principal: PolicyPrincipal,
  op: PolicyOperation,
  target: PolicyTarget,
): PolicyDecision {
  if (op === "delete") {
    return {
      allowed: false,
      code: "delete_forbidden",
      reason: "Hard deletes are forbidden. Archive notes instead.",
    };
  }

  const path = targetPath(target);
  const lockDecision = lockedPathDecision(principal, op, path, target.frontmatter);
  if (lockDecision) return lockDecision;

  const frontmatterDecision = validateFrontmatter(target.frontmatter);
  if (frontmatterDecision) return frontmatterDecision;

  if (principal.kind === "human") {
    return { allowed: true };
  }

  return agentDecision(principal.scopes, op, path);
}

export function validateFrontmatter(
  frontmatter: PolicyTarget["frontmatter"],
): PolicyDecision | null {
  if (!frontmatter) return null;

  if (typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
    return {
      allowed: false,
      code: "frontmatter_invalid",
      reason: "Frontmatter must be an object.",
    };
  }

  const allowedKeys = new Set([
    "created_by",
    "created_at",
    "tags",
    "lock",
    "source_url",
    "wiki_links",
    "append_sections",
  ]);

  for (const key of Object.keys(frontmatter)) {
    if (!allowedKeys.has(key)) {
      return {
        allowed: false,
        code: "frontmatter_invalid",
        reason: `Unknown frontmatter key: ${key}`,
      };
    }
  }

  if (typeof frontmatter.created_by !== "string" || !frontmatter.created_by.trim()) {
    return {
      allowed: false,
      code: "frontmatter_invalid",
      reason: "Frontmatter must include created_by.",
    };
  }

  if (
    typeof frontmatter.created_at !== "string" ||
    Number.isNaN(Date.parse(frontmatter.created_at))
  ) {
    return {
      allowed: false,
      code: "frontmatter_invalid",
      reason: "Frontmatter must include created_at.",
    };
  }

  return null;
}

export function targetPath(target: PolicyTarget): string {
  const folder = normalizePath(target.folder || "00_inbox");
  const slug = target.slug ? normalizePath(target.slug) : "";
  const filename = slug.endsWith(".md") ? slug : slug ? `${slug}.md` : "";
  return filename ? normalizePath(`${folder}/${filename}`) : folder;
}

function lockedPathDecision(
  principal: PolicyPrincipal,
  op: PolicyOperation,
  path: string,
  frontmatter: PolicyTarget["frontmatter"],
): PolicyDecision | null {
  if (frontmatter?.lock === true) {
    return {
      allowed: false,
      code: "locked_path",
      reason: "This note is locked.",
    };
  }

  if (lockedExactPaths.has(path) || path.startsWith("06_system/commands/")) {
    return {
      allowed: false,
      code: "locked_path",
      reason: "This system path is locked.",
    };
  }

  if (
    principal.kind === "agent" &&
    op === "edit" &&
    /^01_thinking\/[^/]+\.md$/.test(path)
  ) {
    return {
      allowed: false,
      code: "locked_path",
      reason: "Agents cannot edit MOC bodies directly.",
      hint: "Use append op instead",
    };
  }

  return null;
}

function agentDecision(
  scopes: AgentScopes,
  op: Exclude<PolicyOperation, "delete">,
  path: string,
): PolicyDecision {
  if (!scopes.ops.includes(op as AgentScopeOperation)) {
    return {
      allowed: false,
      code: "op_not_allowed",
      reason: `Agent scope does not allow ${op}.`,
    };
  }

  const decision = matchScope(scopes, path, op as AgentScopeOperation);

  if (decision.allowed) return { allowed: true };

  return {
    allowed: false,
    code: decision.reason,
    reason:
      decision.reason === "op_not_allowed"
        ? `Agent scope does not allow ${op}.`
        : `Agent scope does not allow ${op} on ${path}.`,
  };
}

function normalizePath(path: string): string {
  const normalized: string[] = [];

  for (const segment of path.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;

    if (segment === "..") {
      if (normalized.length === 0) return "";
      normalized.pop();
      continue;
    }

    normalized.push(segment);
  }

  return normalized.join("/");
}
