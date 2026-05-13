import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

type InvitationRow = {
  id: string;
  role: string;
  teams:
    | {
        name: string;
        slug: string;
      }
    | {
        name: string;
        slug: string;
      }[]
    | null;
};

export async function GET() {
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

  const admin = createAdminSupabaseClient();
  const { data, error } = user.email
    ? await admin
        .from("team_invitations")
        .select("id, role, teams:teams(name, slug)")
        .eq("email", user.email)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (error) {
    return withSupabaseResponseHeaders(
      NextResponse.json({ error: error.message }, { status: 400 })
    );
  }

  const invites = ((data ?? []) as InvitationRow[]).flatMap((row) => {
    const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;

    if (!team) return [];

    return [
      {
        id: row.id,
        teamName: team.name,
        teamSlug: team.slug,
        role: row.role,
      },
    ];
  });

  return withSupabaseResponseHeaders(NextResponse.json({ invites }));
}
