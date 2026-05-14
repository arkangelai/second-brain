import { NextResponse } from "next/server";

import { requireNotesPrincipal } from "@/lib/notes/http";
import { listRevisions } from "@/lib/notes/service";

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

  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get("limit") || "50", 10);
  const before = url.searchParams.get("before");
  if (before !== null && Number.isNaN(Date.parse(before))) {
    return NextResponse.json(
      { error: "Invalid 'before' parameter; expected an ISO 8601 timestamp" },
      { status: 400 },
    );
  }
  const beforeId = url.searchParams.get("before_id");
  if (beforeId !== null && before === null) {
    return NextResponse.json({ error: "'before_id' requires 'before'" }, { status: 400 });
  }
  if (beforeId !== null && !isUuid(beforeId)) {
    return NextResponse.json(
      { error: "Invalid 'before_id' parameter; expected a UUID" },
      { status: 400 },
    );
  }

  const full = url.searchParams.get("full") === "true";
  const { slug } = await context.params;
  const result = await listRevisions(principal, slug, {
    before,
    beforeId,
    full,
    limit: Number.isFinite(limit) ? limit : 50,
  });

  if (!result.ok) {
    return NextResponse.json(result.error.body, {
      status: result.error.status,
    });
  }

  return NextResponse.json(result.value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
