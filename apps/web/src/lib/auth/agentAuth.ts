import type { SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@second-brain/shared/env";

import { parseAgentKey, verifyKey } from "./agentKeys";
import { bearerToken, clientIp } from "./request";
import { withTeamContext } from "@/lib/db/withTeamContext";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_FAILURE_LIMIT = 10;
const DEFAULT_FAILURE_WINDOW_MINUTES = 5;

type TeamRecord = {
  id: string;
  slug: string;
  name: string;
};

type KeyRecord = {
  id: string;
  team_id: string;
  member_id: string;
  name: string;
  key_hash: string;
  scopes: unknown;
  revoked_at: string | null;
  expires_at: string | null;
};

type AgentRecord = {
  member_id: string;
  display_name: string;
  scopes: unknown;
  active: boolean;
  revoked_at: string | null;
};

export type AgentAuthContext = {
  supabase: SupabaseClient;
  team: TeamRecord;
  agent: AgentRecord;
  key: KeyRecord;
};

export async function authenticateAgentRequest(
  request: Request,
): Promise<AgentAuthContext | null> {
  const plaintext = bearerToken(request) || request.headers.get("x-agent-key");
  const supabase = createSupabaseAdminClient({ routeHandler: true });

  if (!plaintext) {
    await logAuthFailure(supabase, request, { reason: "missing_key" });
    return null;
  }

  const parsedKey = parseAgentKey(plaintext);
  if (!parsedKey) {
    await logAuthFailure(supabase, request, { reason: "malformed_key" });
    return null;
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, slug, name")
    .eq("slug", parsedKey.teamSlug)
    .maybeSingle();

  if (!team) {
    await logAuthFailure(supabase, request, {
      reason: "unknown_team",
      keyPrefix: parsedKey.prefix,
      teamSlug: parsedKey.teamSlug,
    });
    return null;
  }

  const { data: key } = await supabase
    .from("team_member_api_keys")
    .select("id, team_id, member_id, name, key_hash, scopes, revoked_at, expires_at")
    .eq("team_id", team.id)
    .eq("key_prefix", parsedKey.prefix)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!key) {
    await logAuthFailure(supabase, request, {
      reason: "unknown_key",
      teamId: team.id,
      keyPrefix: parsedKey.prefix,
      teamSlug: parsedKey.teamSlug,
    });
    return null;
  }

  const typedKey = key as KeyRecord;
  if (typedKey.revoked_at) {
    await logAuthFailure(supabase, request, {
      reason: "revoked_key",
      teamId: team.id,
      memberId: typedKey.member_id,
      keyId: typedKey.id,
      keyPrefix: parsedKey.prefix,
      teamSlug: parsedKey.teamSlug,
    });
    return null;
  }

  const { data: agent, error: agentError } = await supabase
    .from("team_members")
    .select("member_id, display_name, scopes, active, revoked_at")
    .eq("team_id", team.id)
    .eq("member_id", typedKey.member_id)
    .eq("member_type", "agent")
    .maybeSingle();

  if (agentError) {
    console.error("Unable to look up agent membership during auth", {
      teamId: team.id,
      memberId: typedKey.member_id,
      keyId: typedKey.id,
      error: agentError,
    });
    return null;
  }

  if (!agent || !agent.active || agent.revoked_at) {
    await logAuthFailure(supabase, request, {
      reason: "revoked_key",
      teamId: team.id,
      memberId: typedKey.member_id,
      keyId: typedKey.id,
      keyPrefix: parsedKey.prefix,
      teamSlug: parsedKey.teamSlug,
    });
    return null;
  }

  if (isExpiredKey(typedKey.expires_at)) {
    await logAuthFailure(supabase, request, {
      reason: "expired_key",
      teamId: team.id,
      memberId: typedKey.member_id,
      keyId: typedKey.id,
      keyPrefix: parsedKey.prefix,
      teamSlug: parsedKey.teamSlug,
    });
    return null;
  }

  const locked = await isLockedOut(supabase, typedKey.id);
  if (locked) {
    await logAuthFailure(supabase, request, {
      reason: "locked_key",
      teamId: team.id,
      memberId: typedKey.member_id,
      keyId: typedKey.id,
      keyPrefix: parsedKey.prefix,
      teamSlug: parsedKey.teamSlug,
    });
    await logAgentEvent(supabase, {
      eventType: "agent_key_locked",
      teamId: team.id,
      memberId: typedKey.member_id,
      keyId: typedKey.id,
      metadata: { key_prefix: parsedKey.prefix },
    });
    return null;
  }

  const verified = await verifyKey(plaintext, typedKey.key_hash);
  if (!verified) {
    await logAuthFailure(supabase, request, {
      reason: "invalid_secret",
      teamId: team.id,
      memberId: typedKey.member_id,
      keyId: typedKey.id,
      keyPrefix: parsedKey.prefix,
      teamSlug: parsedKey.teamSlug,
    });

    if (await isLockedOut(supabase, typedKey.id)) {
      await logAgentEvent(supabase, {
        eventType: "agent_key_locked",
        teamId: team.id,
        memberId: typedKey.member_id,
        keyId: typedKey.id,
        metadata: { key_prefix: parsedKey.prefix },
      });
    }

    return null;
  }

  const now = new Date().toISOString();
  try {
    await touchAgentActivity({
      supabase,
      teamId: team.id,
      memberId: typedKey.member_id,
      keyId: typedKey.id,
      now,
    });
  } catch (error) {
    console.error("Unable to update agent activity after successful auth", {
      teamId: team.id,
      memberId: typedKey.member_id,
      keyId: typedKey.id,
      error,
    });
  }

  return {
    supabase,
    team: {
      id: team.id,
      slug: String(team.slug),
      name: team.name,
    },
    agent: agent as AgentRecord,
    key: typedKey,
  };
}

// Writes last_used_at / last_seen_at after a successful agent authentication.
//
// When SUPABASE_DB_URL is configured, both writes happen inside a single
// transaction with app.team_id set to the agent's team — exercising the RLS
// scope primitive (see supabase/migrations/0001_init.sql, app_set_team). When
// SUPABASE_DB_URL is unset (e.g. local UI dev), falls back to the service-role
// Supabase client which bypasses RLS.
async function touchAgentActivity(args: {
  supabase: SupabaseClient;
  teamId: string;
  memberId: string;
  keyId: string;
  now: string;
}): Promise<void> {
  const { supabase, teamId, memberId, keyId, now } = args;

  if (serverEnv.SUPABASE_DB_URL) {
    await withTeamContext(
      teamId,
      async (client) => {
        await client.query(
          "update public.team_member_api_keys set last_used_at = $1 where id = $2",
          [now, keyId],
        );
        await client.query(
          "update public.team_members set last_seen_at = $1 where team_id = $2 and member_id = $3",
          [now, teamId, memberId],
        );
      },
      { trusted: true },
    );
    return;
  }

  await Promise.all([
    supabase
      .from("team_member_api_keys")
      .update({ last_used_at: now })
      .eq("id", keyId),
    supabase
      .from("team_members")
      .update({ last_seen_at: now })
      .eq("team_id", teamId)
      .eq("member_id", memberId),
  ]);
}

export async function logAgentEvent(
  supabase: SupabaseClient,
  {
    eventType,
    teamId,
    memberId,
    keyId,
    actorUserId,
    metadata = {},
  }: {
    eventType: string;
    teamId: string;
    memberId?: string | null;
    keyId?: string | null;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await supabase.from("agent_logs").insert({
    team_id: teamId,
    member_id: memberId ?? null,
    key_id: keyId ?? null,
    actor_user_id: actorUserId ?? null,
    event_type: eventType,
    metadata,
  });
}

async function logAuthFailure(
  supabase: SupabaseClient,
  request: Request,
  {
    reason,
    teamId,
    memberId,
    keyId,
    keyPrefix,
    teamSlug,
  }: {
    reason: string;
    teamId?: string;
    memberId?: string;
    keyId?: string;
    keyPrefix?: string;
    teamSlug?: string;
  },
): Promise<void> {
  await supabase.from("agent_auth_failures").insert({
    team_id: teamId ?? null,
    member_id: memberId ?? null,
    key_id: keyId ?? null,
    key_prefix: keyPrefix ?? null,
    team_slug: teamSlug ?? null,
    failure_reason: reason,
    request_ip: clientIp(request),
    user_agent: request.headers.get("user-agent"),
  });
}

async function isLockedOut(
  supabase: SupabaseClient,
  keyId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - failureWindowMinutes() * 60_000);
  const { count } = await supabase
    .from("agent_auth_failures")
    .select("id", { count: "exact", head: true })
    .eq("key_id", keyId)
    .gte("created_at", since.toISOString());

  return (count ?? 0) >= failureLimit();
}

function failureLimit(): number {
  return positiveInt(process.env.AGENT_AUTH_FAILURE_LIMIT, DEFAULT_FAILURE_LIMIT);
}

function failureWindowMinutes(): number {
  return positiveInt(
    process.env.AGENT_AUTH_FAILURE_WINDOW_MINUTES,
    DEFAULT_FAILURE_WINDOW_MINUTES,
  );
}

function positiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isExpiredKey(expiresAt: string | null): boolean {
  return expiresAt !== null && Date.parse(expiresAt) <= Date.now();
}
