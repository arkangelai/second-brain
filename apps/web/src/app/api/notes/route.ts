import { CreateNoteRequestSchema } from "@second-brain/shared";

import { jsonError } from "@/lib/api/responses";
import { createNote, listNotes } from "@/lib/notes/service";
import { notesResultJson, parseJsonBody, requireNotesPrincipal } from "@/lib/notes/http";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const principal = await requireNotesPrincipal(request);
  if (principal instanceof Response) return principal;

  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("include_archived") === "true";
  const folder = url.searchParams.get("folder");
  const q = url.searchParams.get("q");
  const updatedBefore = url.searchParams.get("updated_before");
  if (updatedBefore !== null && Number.isNaN(Date.parse(updatedBefore))) {
    return jsonError("Invalid 'updated_before' parameter; expected an ISO 8601 timestamp", 400);
  }

  const updatedBeforeId = url.searchParams.get("updated_before_id");
  if (updatedBeforeId !== null && updatedBefore === null) {
    return jsonError("'updated_before_id' requires 'updated_before'", 400);
  }
  if (updatedBeforeId !== null && !isUuid(updatedBeforeId)) {
    return jsonError("Invalid 'updated_before_id' parameter; expected a UUID", 400);
  }

  const limit = Number.parseInt(url.searchParams.get("limit") || "100", 10);

  return notesResultJson(
    await listNotes(principal, {
      includeArchived,
      folder,
      q,
      updatedBefore,
      updatedBeforeId,
      limit: Number.isFinite(limit) ? limit : 100,
    }),
  );
}

export async function POST(request: Request): Promise<Response> {
  const principal = await requireNotesPrincipal(request);
  if (principal instanceof Response) return principal;

  const body = await parseJsonBody(request, CreateNoteRequestSchema);
  if (body instanceof Response) return body;

  return notesResultJson(await createNote(principal, body), 201);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
