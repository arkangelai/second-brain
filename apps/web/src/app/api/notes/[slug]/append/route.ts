import { AppendNoteRequestSchema } from "@second-brain/shared";

import { notesResultJson, parseJsonBody, requireNotesPrincipal } from "@/lib/notes/http";
import { appendNote } from "@/lib/notes/service";

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

  const body = await parseJsonBody(request, AppendNoteRequestSchema);
  if (body instanceof Response) return body;

  const { slug } = await context.params;
  return notesResultJson(await appendNote(principal, slug, body));
}
