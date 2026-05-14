import { NextResponse } from "next/server";
import { AgentScopesSchema } from "@second-brain/shared";

import { jsonError } from "@/lib/api/responses";
import { logAgentEvent } from "@/lib/auth/agentAuth";
import { resolveAdminContext } from "@/lib/auth/admin";
import { generateKey, hashKey } from "@/lib/auth/agentKeys";

export const runtime = "nodejs";

type CreateAgentBody = {
  name?: unknown;
  description?: unknown;
  scopes?: unknown;
  team_id?: unknown;
  team_slug?: unknown;
};

type AgentRow = {
  member_id: string;
  display_name: string | null;
  scopes: unknown;
  active: boolean;
  revoked_at: string | null;
  last_seen_at: string | null;
  joined_at: string;
  created_by_user_id: string | null;
};

export async function GET(request: Request): Promise<NextResponse> {
  const context = await resolveAdminContext(request);
  if ("error" in context) return jsonError(context.error, context.status);

  const { data, error } = await context.supabase
    .from("team_members")
    .select(
      "member_id, display_name, scopes, active, revoked_at, last_seen_at, joined_at, created_by_user_id",
    )
    .eq("team_id", context.team.id)
    .eq("member_type", "agent")
    .order("joined_at", { ascending: false });

  if (error) return jsonError("Unable to list agents", 500);

  return NextResponse.json({
    agents: ((data ?? []) as AgentRow[]).map(toAgentSummary),
    role: context.role,
    canManage: true,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: CreateAgentBody;

  try {
    body = (await request.json()) as CreateAgentBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const context = await resolveAdminContext(request, body);
  if ("error" in context) return jsonError(context.error, context.status);

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return jsonError("Agent name is required", 400);

  const scopesResult = AgentScopesSchema.safeParse(body.scopes);
  if (!scopesResult.success) {
    return jsonError("Scopes must match the agent scopes schema", 400);
  }
  const scopes = scopesResult.data;

  const memberId = crypto.randomUUID();
  const key = generateKey(context.team.slug);
  const keyHash = await hashKey(key.plaintext);

  const { data: agent, error: agentError } = await context.supabase
    .from("team_members")
    .insert({
      team_id: context.team.id,
      member_id: memberId,
      member_type: "agent",
      user_id: null,
      role: "member",
      invited_by: context.user.id,
      display_name: name,
      scopes,
      created_by_user_id: context.user.id,
      active: true,
      revoked_at: null,
    })
    .select(
      "member_id, display_name, scopes, active, revoked_at, last_seen_at, joined_at, created_by_user_id",
    )
    .single();

  if (agentError || !agent) return jsonError("Unable to create agent", 500);

  const { data: apiKey, error: keyError } = await context.supabase
    .from("team_member_api_keys")
    .insert({
      team_id: context.team.id,
      member_id: memberId,
      name: `${name} primary key`,
      key_prefix: key.prefix,
      key_hash: keyHash,
      scopes,
      created_by_user_id: context.user.id,
    })
    .select("id")
    .single();

  if (keyError || !apiKey) {
    await context.supabase
      .from("team_members")
      .delete()
      .eq("team_id", context.team.id)
      .eq("member_id", memberId);
    return jsonError("Unable to issue agent key", 500);
  }

  await logAgentEvent(context.supabase, {
    eventType: "agent_key_created",
    teamId: context.team.id,
    memberId,
    keyId: apiKey.id,
    actorUserId: context.user.id,
    metadata: {
      agent_name: name,
      key_prefix: key.prefix,
    },
  });

  return NextResponse.json(
    {
      agent: toAgentSummary(agent as AgentRow),
      plaintext_key: key.plaintext,
    },
    { status: 201 },
  );
}

function toAgentSummary(agent: AgentRow) {
  return {
    id: agent.member_id,
    name: agent.display_name ?? "Unnamed agent",
    description: "",
    status: agent.active && !agent.revoked_at ? "active" : "revoked",
    scopes: agent.scopes,
    lastSeen: agent.last_seen_at,
    createdBy: agent.created_by_user_id,
    createdAt: agent.joined_at,
  };
}
