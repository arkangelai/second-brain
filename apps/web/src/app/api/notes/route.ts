import { CreateNoteRequestSchema } from "@second-brain/shared";

import { createNote } from "@/lib/notes/service";
import { notesResultJson, parseJsonBody, requireNotesPrincipal } from "@/lib/notes/http";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const principal = await requireNotesPrincipal(request);
  if (principal instanceof Response) return principal;

  const body = await parseJsonBody(request, CreateNoteRequestSchema);
  if (body instanceof Response) return body;

  return notesResultJson(await createNote(principal, body), 201);
}
