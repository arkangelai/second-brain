import { NextResponse } from "next/server";
import { PatchNoteRequestSchema } from "@second-brain/shared";

import { getNote, patchNote } from "@/lib/notes/service";
import { notesResultJson, parseJsonBody, requireNotesPrincipal } from "@/lib/notes/http";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const principal = await requireNotesPrincipal(request);
  if (principal instanceof Response) return principal;

  const { slug } = await context.params;
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("include_archived") === "true";
  const result = await getNote(principal, slug, includeArchived);

  if (!result.ok) {
    return NextResponse.json(result.error.body, {
      status: result.error.status,
      headers: result.error.headers,
    });
  }

  return NextResponse.json(result.value, {
    headers: result.headers,
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const principal = await requireNotesPrincipal(request);
  if (principal instanceof Response) return principal;

  const body = await parseJsonBody(request, PatchNoteRequestSchema);
  if (body instanceof Response) return body;

  const { slug } = await context.params;
  return notesResultJson(await patchNote(principal, slug, body));
}
