import "server-only";

import argon2 from "argon2";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json, TeamRole } from "@/lib/supabase/types";

import { getBearerToken, parseAgentApiKey } from "./api-key";
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
  key_hash: string;
  scopes: Json;
  expires_at: string | null;
  revoked_at: string | null;
};

export async function resolveRequestPrincipal(
  request: HumanPrincipalRequest
): Promise<Principal | null> {
  const bearerToken = getBearerToken(request.headers.get("authorization"));

  if (bearerToken) {
    return resolveAgentPrincipal(bearerToken);
  }

  return resolveHumanPrincipal(request);
}

async function resolveAgentPrincipal(token: string): Promise<AgentPrincipal | null> {
  const parsed = parseAgentApiKey(token);
  if (!parsed) return null;

  const admin = createSupabaseAdminClient({ routeHandler: true });
  const { data: team } = await admin
    .from("teams")
    .select("id")
    .eq("slug", parsed.teamSlug)
    .maybeSingle();

  if (!team) return null;

  const { data: keys, error } = await admin
    .from("team_member_api_keys")
    .select("id, team_id, member_id, key_hash, scopes, expires_at, revoked_at")
    .eq("team_id", team.id)
    .is("revoked_at", null);

  if (error || !keys) return null;

  const matchingKey = await findMatchingAgentKey(keys, parsed.secret);
  if (!matchingKey) return null;

  const { data: member } = await admin
    .from("team_members")
    .select("team_id, member_id, member_type, user_id, role, scopes, active, revoked_at")
    .eq("team_id", matchingKey.team_id)
    .eq("member_id", matchingKey.member_id)
    .eq("member_type", "agent")
    .eq("active", true)
    .is("revoked_at", null)
    .maybeSingle();

  if (!member || member.role === "owner") return null;

  await admin
    .from("team_member_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", matchingKey.id);

  return {
    kind: "agent",
    id: member.member_id,
    team_id: member.team_id,
    role: member.role,
    scopes: normalizeScopes(matchingKey.scopes, member.scopes),
  };
}

async function findMatchingAgentKey(keys: ApiKeyRow[], secret: string): Promise<ApiKeyRow | null> {
  let match: ApiKeyRow | null = null;
  const now = Date.now();

  for (const key of keys) {
    const expired = key.expires_at ? Date.parse(key.expires_at) <= now : false;
    if (expired || key.revoked_at) continue;

    if (await argon2.verify(key.key_hash, secret)) {
      match = key;
    }
  }

  return match;
}

function normalizeScopes(keyScopes: Json, memberScopes: Json): string[] {
  const scopes = Array.isArray(keyScopes) && keyScopes.length > 0 ? keyScopes : memberScopes;

  if (!Array.isArray(scopes)) return [];

  return scopes.filter((scope): scope is string => typeof scope === "string");
}
