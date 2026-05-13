import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/responses";
import { authenticateAgentRequest } from "@/lib/auth/agentAuth";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authenticateAgentRequest(request);
  if (!auth) return jsonError("Invalid agent credentials", 401);

  return NextResponse.json({
    team: {
      id: auth.team.id,
      slug: auth.team.slug,
      name: auth.team.name,
    },
    agent_name: auth.agent.display_name,
    scopes: auth.key.scopes ?? auth.agent.scopes,
    server_time: new Date().toISOString(),
  });
}
