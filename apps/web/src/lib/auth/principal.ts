import "server-only";

import argon2 from "argon2";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json, TeamRole } from "@/lib/supabase/types";

import { getBearerToken, parseAgentApiKey, type ParsedAgentApiKey } from "./api-key";
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
  scopes: string[];
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
  const bearerToken = getBearerToken(request.headers.get("authorization"));
  const parsedAgentKey = bearerToken ? parseAgentApiKey(bearerToken) : null;

  if (parsedAgentKey) {
    return resolveAgentPrincipal(parsedAgentKey);
  }

  return resolveHumanPrincipal(request);
}

async function resolveAgentPrincipal(
  parsed: ParsedAgentApiKey
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
    .eq("key_prefix", parsed.keyPrefix)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !key) return null;

  if (!(await verifyAgentKey(key, parsed.secret))) return null;

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

  return {
    kind: "agent",
    id: member.member_id,
    team_id: member.team_id,
    role: member.role,
    scopes: normalizeScopes(key.scopes, member.scopes),
  };
}

async function verifyAgentKey(key: ApiKeyRow, secret: string): Promise<boolean> {
  const now = Date.now();
  const expired = key.expires_at ? Date.parse(key.expires_at) <= now : false;
  if (expired || key.revoked_at) return false;

  return argon2.verify(key.key_hash, secret);
}

function normalizeScopes(keyScopes: Json, memberScopes: Json): string[] {
  const scopes = Array.isArray(keyScopes) && keyScopes.length > 0 ? keyScopes : memberScopes;

  if (!Array.isArray(scopes)) return [];

  return scopes.filter((scope): scope is string => typeof scope === "string");
}
