import { NextResponse, type NextRequest } from "next/server";

import { setActiveTeamCookie } from "@/lib/auth/active-team";
import { normalizeTeamSlug } from "@/lib/onboarding/slug";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

type CreateTeamResult = {
  id: string;
  slug: string;
  name: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const { supabase, withSupabaseResponseHeaders } =
    await createRouteHandlerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSupabaseResponseHeaders(jsonError("Unauthorized", 401));
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    slug?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const slug = typeof body?.slug === "string" ? normalizeTeamSlug(body.slug) : "";

  if (!name) {
    return withSupabaseResponseHeaders(jsonError("Team name is required", 422));
  }

  const { data, error } = await supabase
    .rpc("app_create_team", {
      team_name: name,
      requested_slug: slug || name,
    })
    .single();

  if (error) {
    return withSupabaseResponseHeaders(jsonError(error.message, 400));
  }

  const team = data as CreateTeamResult;
  const response = NextResponse.json({ team });
  setActiveTeamCookie(response, team.id);
  return withSupabaseResponseHeaders(response);
}
