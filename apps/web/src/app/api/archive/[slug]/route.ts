import { ArchiveNoteRequestSchema } from "@second-brain/shared";

import { notesResultJson, parseJsonBody, requireNotesPrincipal } from "@/lib/notes/http";
import { archiveNote } from "@/lib/notes/service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const principal = await requireNotesPrincipal(request);
  if (principal instanceof Response) return principal;

  const body = await parseJsonBody(request, ArchiveNoteRequestSchema);
  if (body instanceof Response) return body;

  const { slug } = await context.params;
  return notesResultJson(await archiveNote(principal, slug, body));
}
