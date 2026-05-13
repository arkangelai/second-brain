import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/responses";
import { logAgentEvent } from "@/lib/auth/agentAuth";
import { resolveAdminContext } from "@/lib/auth/admin";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const admin = await resolveAdminContext(request);
  if ("error" in admin) return jsonError(admin.error, admin.status);

  const now = new Date().toISOString();
  const { data: agent, error: agentError } = await admin.supabase
    .from("team_members")
    .update({
      active: false,
      revoked_at: now,
    })
    .eq("team_id", admin.team.id)
    .eq("member_id", id)
    .eq("member_type", "agent")
    .select(
      "member_id, display_name, scopes, active, revoked_at, last_seen_at, joined_at, created_by_user_id",
    )
    .maybeSingle();

  if (agentError) return jsonError("Unable to revoke agent", 500);
  if (!agent) return jsonError("Agent not found", 404);

  const { data: revokedKeys, error: keysError } = await admin.supabase
    .from("team_member_api_keys")
    .update({ revoked_at: now })
    .eq("team_id", admin.team.id)
    .eq("member_id", id)
    .is("revoked_at", null)
    .select("id, key_prefix");

  if (keysError) return jsonError("Unable to revoke agent keys", 500);

  await logAgentEvent(admin.supabase, {
    eventType: "agent_key_revoked",
    teamId: admin.team.id,
    memberId: id,
    actorUserId: admin.user.id,
    metadata: {
      agent_name: agent.display_name,
      revoked_key_ids: (revokedKeys ?? []).map((key) => key.id),
      revoked_key_prefixes: (revokedKeys ?? []).map((key) => key.key_prefix),
    },
  });

  return NextResponse.json({
    agent: {
      id: agent.member_id,
      team_id: admin.team.id,
      name: agent.display_name,
      scopes: agent.scopes,
      active: agent.active,
      revoked_at: agent.revoked_at,
      last_seen_at: agent.last_seen_at,
      created_at: agent.joined_at,
      created_by_user_id: agent.created_by_user_id,
    },
  });
}
