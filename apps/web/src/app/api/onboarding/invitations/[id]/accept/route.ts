import { NextResponse, type NextRequest } from "next/server";

import { setActiveTeamCookie } from "@/lib/auth/active-team";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

type AcceptRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AcceptedInvitation = {
  team_id: string;
  team_slug: string;
  team_name: string;
  role: string;
};

function statusForPostgresCode(code?: string): number {
  if (code === "02000") return 410;
  if (code === "42501") return 403;
  if (code === "28000") return 401;
  return 400;
}

export async function POST(_request: NextRequest, context: AcceptRouteContext) {
  const { id } = await context.params;
  const { supabase, withSupabaseResponseHeaders } =
    await createRouteHandlerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSupabaseResponseHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
  }

  const { data, error } = await supabase.rpc("app_accept_invitation", { invitation: id }).single();

  if (error) {
    return withSupabaseResponseHeaders(
      NextResponse.json(
        { error: error.message },
        { status: statusForPostgresCode(error.code) }
      )
    );
  }

  const invitation = data as AcceptedInvitation;
  const response = NextResponse.json({ invitation });
  setActiveTeamCookie(response, invitation.team_id);
  return withSupabaseResponseHeaders(response);
}
