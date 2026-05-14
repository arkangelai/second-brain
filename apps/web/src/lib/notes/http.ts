import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/responses";
import { resolveRequestPrincipal } from "@/lib/auth/principal";
import type { NotesPrincipal, NotesResult } from "@/lib/notes/service";

type ParseSchema<T> = {
  safeParse(
    value: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: unknown } };
};

export async function requireNotesPrincipal(
  request: Request,
): Promise<NotesPrincipal | NextResponse> {
  const principal = await resolveRequestPrincipal(request);
  if (!principal) return jsonError("Authentication required", 401);

  if (principal.kind === "human") {
    return {
      kind: "human",
      id: principal.id,
      team_id: principal.team_id,
      role: principal.role,
    };
  }

  return {
    kind: "agent",
    id: principal.id,
    team_id: principal.team_id,
    role: principal.role,
    scopes: principal.scopes,
  };
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ParseSchema<T>,
): Promise<T | NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  return parsed.data;
}

export function notesResultJson<T>(
  result: NotesResult<T>,
  status = 200,
): NextResponse {
  if (!result.ok) {
    return NextResponse.json(result.error.body, {
      status: result.error.status,
      headers: result.error.headers,
    });
  }

  return NextResponse.json(result.value, {
    status,
    headers: result.headers,
  });
}
