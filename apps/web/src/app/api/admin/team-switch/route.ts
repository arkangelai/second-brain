import { NextResponse, type NextRequest } from "next/server";

import { setActiveTeamCookie } from "@/lib/auth/active-team";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { teamId?: unknown } | null;
  const teamId = typeof body?.teamId === "string" ? body.teamId : "";

  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 422 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .eq("member_type", "human")
    .eq("team_id", teamId)
    .eq("active", true)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 400 });
  }

  if (!membership) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const { error: profileError } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      default_team_id: teamId,
    },
    { onConflict: "user_id" }
  );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const response = NextResponse.json({ teamId });
  setActiveTeamCookie(response, teamId);
  return response;
}
