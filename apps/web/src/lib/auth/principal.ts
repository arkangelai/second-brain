import "server-only";

import { AgentScopesSchema, type AgentScopes } from "@second-brain/shared";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json, TeamRole } from "@/lib/supabase/types";

import { parseAgentKey, verifyKey, type ParsedAgentKey } from "./agentKeys";
import {
  resolveHumanPrincipal,
  type HumanPrincipal,
  type HumanPrincipalRequest,
} from "./human-principal";

export type AgentPrincipal = {
  kind: "agent";
  id: string;
  team_id: string;
  role: Exclude<TeamRole, "owner">;
  scopes: AgentScopes;
};

export type Principal = HumanPrincipal | AgentPrincipal;

type ApiKeyRow = {
  id: string;
  team_id: string;
  member_id: string;
  key_prefix: string | null;
  key_hash: string;
  scopes: Json;
  expires_at: string | null;
  revoked_at: string | null;
};

export async function resolveRequestPrincipal(
  request: HumanPrincipalRequest
): Promise<Principal | null> {
  const token = extractBearerToken(request.headers.get("authorization"));
  const parsedAgentKey = token ? parseAgentKey(token) : null;

  if (parsedAgentKey) {
    return resolveAgentPrincipal(parsedAgentKey);
  }

  return resolveHumanPrincipal(request);
}

async function resolveAgentPrincipal(
  parsed: ParsedAgentKey
): Promise<AgentPrincipal | null> {
  const admin = createSupabaseAdminClient({ routeHandler: true });
  const { data: team } = await admin
    .from("teams")
    .select("id")
    .eq("slug", parsed.teamSlug)
    .maybeSingle();

  if (!team) return null;

  const { data: key, error } = await admin
    .from("team_member_api_keys")
    .select(
      "id, team_id, member_id, key_prefix, key_hash, scopes, expires_at, revoked_at"
    )
    .eq("team_id", team.id)
    .eq("key_prefix", parsed.prefix)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !key) return null;

  if (!(await verifyAgentKey(key, parsed.plaintext))) return null;

  const { data: member } = await admin
    .from("team_members")
    .select("team_id, member_id, member_type, user_id, role, scopes, active, revoked_at")
    .eq("team_id", key.team_id)
    .eq("member_id", key.member_id)
    .eq("member_type", "agent")
    .eq("active", true)
    .is("revoked_at", null)
    .maybeSingle();

  if (!member || member.role === "owner") return null;

  await admin
    .from("team_member_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  const scopes = normalizeScopes(key.scopes, member.scopes);
  if (!scopes) return null;

  return {
    kind: "agent",
    id: member.member_id,
    team_id: member.team_id,
    role: member.role,
    scopes,
  };
}

async function verifyAgentKey(key: ApiKeyRow, plaintext: string): Promise<boolean> {
  const now = Date.now();
  const expired = key.expires_at ? Date.parse(key.expires_at) <= now : false;
  if (expired || key.revoked_at) return false;

  return verifyKey(plaintext, key.key_hash);
}

function normalizeScopes(keyScopes: Json, memberScopes: Json): AgentScopes | null {
  const candidate = isNonEmptyObject(keyScopes) ? keyScopes : memberScopes;
  const result = AgentScopesSchema.safeParse(candidate);
  return result.success ? result.data : null;
}

function extractBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || null;
}

function isNonEmptyObject(value: Json): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}
