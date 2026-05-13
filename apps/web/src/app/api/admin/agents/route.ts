import { NextResponse } from "next/server";

import {
  createAgent,
  getAdminAgentsContext,
  listAgents,
  RequestError,
} from "@/lib/admin-agents-store";

export async function GET(request: Request) {
  try {
    const context = getAdminAgentsContext(request);
    const agents = await listAgents(context);

    return NextResponse.json({
      agents,
      role: context.role,
      canManage: context.canManage,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = getAdminAgentsContext(request);
    const payload = parseCreateAgentPayload(await request.json());
    const { agent, plaintextKey } = await createAgent(context, payload);

    return NextResponse.json(
      {
        agent,
        plaintext_key: plaintextKey,
      },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(error);
  }
}

function jsonError(error: unknown) {
  if (error instanceof RequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json(
    { error: "Unexpected admin agent error." },
    { status: 500 }
  );
}

function parseCreateAgentPayload(value: unknown): {
  name: string;
  description: string;
  scopes: unknown;
} {
  if (typeof value !== "object" || value === null) {
    throw new RequestError(400, "Request body must be an object.");
  }

  const candidate = value as {
    name?: unknown;
    description?: unknown;
    scopes?: unknown;
  };

  if (typeof candidate.name !== "string" || candidate.name.trim().length < 2) {
    throw new RequestError(400, "Agent name must be at least 2 characters.");
  }

  if (
    candidate.description !== undefined &&
    typeof candidate.description !== "string"
  ) {
    throw new RequestError(400, "Description must be text.");
  }

  return {
    name: candidate.name.trim(),
    description: candidate.description?.trim() ?? "",
    scopes: candidate.scopes,
  };
}
