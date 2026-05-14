import { notesResultJson, requireNotesPrincipal } from "@/lib/notes/http";
import { restoreNote } from "@/lib/notes/service";

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

  const { slug } = await context.params;
  return notesResultJson(await restoreNote(principal, slug));
}
