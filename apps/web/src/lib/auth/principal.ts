import "server-only";

import argon2 from "argon2";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json, TeamRole } from "@/lib/supabase/types";

import { getBearerToken, parseAgentApiKey } from "./api-key";

export type HumanPrincipal = {
  kind: "human";
  id: string;
  team_id: string;
  role: TeamRole;
};

export type AgentPrincipal = {
  kind: "agent";
  id: string;
  team_id: string;
  role: Exclude<TeamRole, "owner">;
  scopes: string[];
};

export type Principal = HumanPrincipal | AgentPrincipal;

type MembershipRow = {
  team_id: string;
  member_id: string;
  member_type: "human" | "agent";
  user_id: string | null;
  role: TeamRole;
  scopes: Json;
  active: boolean;
  revoked_at: string | null;
};

type ApiKeyRow = {
  id: string;
  team_id: string;
  member_id: string;
  key_hash: string;
  scopes: Json;
  expires_at: string | null;
  revoked_at: string | null;
};

export async function resolveRequestPrincipal(request: Request): Promise<Principal | null> {
  const bearerToken = getBearerToken(request.headers.get("authorization"));

  if (bearerToken) {
    return resolveAgentPrincipal(bearerToken);
  }

  return resolveHumanPrincipal(request);
}

async function resolveHumanPrincipal(request: Request): Promise<HumanPrincipal | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const requestedTeamId = request.headers.get("x-team-id");
  const defaultTeamId = requestedTeamId ? null : await getDefaultTeamId(user.id);

  const membership = await findHumanMembership(user.id, requestedTeamId ?? defaultTeamId);

  if (!membership) return null;

  return {
    kind: "human",
    id: user.id,
    team_id: membership.team_id,
    role: membership.role,
  };
}

async function getDefaultTeamId(userId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("default_team_id")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.default_team_id ?? null;
}

async function findHumanMembership(
  userId: string,
  teamId: string | null
): Promise<MembershipRow | null> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("team_members")
    .select("team_id, member_id, member_type, user_id, role, scopes, active, revoked_at")
    .eq("user_id", userId)
    .eq("member_type", "human")
    .eq("active", true)
    .is("revoked_at", null)
    .order("joined_at", { ascending: true })
    .limit(1);

  if (teamId) {
    query = query.eq("team_id", teamId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  return data;
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

    try {
      if (await argon2.verify(key.key_hash, secret)) {
        match = key;
      }
    } catch {
      continue;
    }
  }

  return match;
}

function normalizeScopes(keyScopes: Json, memberScopes: Json): string[] {
  const scopes = Array.isArray(keyScopes) && keyScopes.length > 0 ? keyScopes : memberScopes;

  if (!Array.isArray(scopes)) return [];

  return scopes.filter((scope): scope is string => typeof scope === "string");
}
