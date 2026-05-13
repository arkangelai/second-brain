import type { SupabaseClient, User } from "@supabase/supabase-js";

import { bearerToken } from "./request";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type Team = {
  id: string;
  slug: string;
  name: string;
};

export type AdminContext = {
  supabase: SupabaseClient;
  user: User;
  team: Team;
  role: "owner" | "admin";
};

type TeamSelector = {
  team_id?: unknown;
  team_slug?: unknown;
};

export async function resolveAdminContext(
  request: Request,
  selector: TeamSelector = {},
): Promise<AdminContext | { error: string; status: number }> {
  const token = bearerToken(request);
  if (!token) return { error: "Missing bearer token", status: 401 };

  const supabase = getSupabaseAdminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData.user;

  if (userError || !user) {
    return { error: "Invalid bearer token", status: 401 };
  }

  const team = await resolveTeam(supabase, user.id, request, selector);
  if (!team) return { error: "Team not found", status: 404 };

  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", team.id)
    .eq("user_id", user.id)
    .eq("member_type", "human")
    .eq("active", true)
    .maybeSingle();

  if (membershipError) {
    return { error: "Unable to verify team membership", status: 500 };
  }

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "Admin access required", status: 403 };
  }

  return {
    supabase,
    user,
    team,
    role: membership.role as "owner" | "admin",
  };
}

async function resolveTeam(
  supabase: SupabaseClient,
  userId: string,
  request: Request,
  selector: TeamSelector,
): Promise<Team | null> {
  const url = new URL(request.url);
  const requestedTeamId =
    stringValue(selector.team_id) ||
    url.searchParams.get("team_id") ||
    request.headers.get("x-team-id");
  const requestedTeamSlug =
    stringValue(selector.team_slug) ||
    url.searchParams.get("team_slug") ||
    request.headers.get("x-team-slug");

  if (requestedTeamId) {
    return await findTeam(supabase, "id", requestedTeamId);
  }

  if (requestedTeamSlug) {
    return await findTeam(supabase, "slug", requestedTeamSlug);
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("default_team_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.default_team_id) {
    const defaultTeam = await findTeam(supabase, "id", profile.default_team_id);
    if (defaultTeam) return defaultTeam;
  }

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .eq("member_type", "human")
    .order("joined_at", { ascending: true })
    .limit(1);

  const firstTeamId = memberships?.[0]?.team_id;
  return firstTeamId ? await findTeam(supabase, "id", firstTeamId) : null;
}

async function findTeam(
  supabase: SupabaseClient,
  column: "id" | "slug",
  value: string,
): Promise<Team | null> {
  const { data, error } = await supabase
    .from("teams")
    .select("id, slug, name")
    .eq(column, value)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    slug: String(data.slug),
    name: data.name,
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
