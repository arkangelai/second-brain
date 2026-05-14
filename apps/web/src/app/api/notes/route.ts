import { CreateNoteRequestSchema } from "@second-brain/shared";

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
  const limit = Number.parseInt(url.searchParams.get("limit") || "100", 10);

  return notesResultJson(
    await listNotes(principal, {
      includeArchived,
      folder,
      q,
      updatedBefore,
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
