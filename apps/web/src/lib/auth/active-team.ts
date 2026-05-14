import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

export const ACTIVE_TEAM_COOKIE = "sb_active_team";

const ACTIVE_TEAM_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type TeamMembership = {
  teamId: string;
  role: "owner" | "admin" | "member";
  team: {
    id: string;
    name: string;
    slug: string;
  };
};

type MembershipRow = {
  team_id: string;
  role: TeamMembership["role"];
  teams:
    | {
        id: string;
        name: string;
        slug: string;
      }
    | {
        id: string;
        name: string;
        slug: string;
      }[]
    | null;
};

export async function getHumanMemberships(
  supabase: SupabaseClient,
  userId: string
): Promise<TeamMembership[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, role, teams:teams(id, name, slug)")
    .eq("user_id", userId)
    .eq("member_type", "human")
    .eq("active", true)
    .order("joined_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as MembershipRow[]).flatMap((row) => {
    const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;

    if (!team) return [];

    return [
      {
        teamId: row.team_id,
        role: row.role,
        team,
      },
    ];
  });
}

export async function getDefaultTeamId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("default_team_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data?.default_team_id as string | null | undefined) ?? null;
}

export function resolveActiveTeamId(
  memberships: TeamMembership[],
  requestedTeamId?: string | null,
  defaultTeamId?: string | null
): string | null {
  if (memberships.length === 0) return null;

  const membershipIds = new Set(memberships.map((membership) => membership.teamId));

  if (requestedTeamId && membershipIds.has(requestedTeamId)) {
    return requestedTeamId;
  }

  if (defaultTeamId && membershipIds.has(defaultTeamId)) {
    return defaultTeamId;
  }

  return memberships[0]?.teamId ?? null;
}

export function setActiveTeamCookie(response: NextResponse, teamId: string) {
  response.cookies.set(ACTIVE_TEAM_COOKIE, teamId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTIVE_TEAM_COOKIE_MAX_AGE,
  });
}
