import type { SupabaseClient, User } from "@supabase/supabase-js";

import { ACTIVE_TEAM_COOKIE } from "@/lib/auth/active-team";
import { bearerToken } from "./request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  const supabase = createSupabaseAdminClient({ routeHandler: true });
  const { user, error: userError } = token
    ? await resolveBearerUser(supabase, token)
    : await resolveSessionUser();

  if (userError || !user) {
    return {
      error: token ? "Invalid bearer token" : "Authentication required",
      status: 401,
    };
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

async function resolveBearerUser(
  supabase: SupabaseClient,
  token: string,
): Promise<{ user: User | null; error: unknown }> {
  const { data: userData, error } = await supabase.auth.getUser(token);
  const user = userData.user;

  return { user, error };
}

async function resolveSessionUser(): Promise<{ user: User | null; error: unknown }> {
  const sessionSupabase = await createServerSupabaseClient();
  const { data, error } = await sessionSupabase.auth.getUser();

  return { user: data.user, error };
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
  const activeTeamId = requestCookie(request, ACTIVE_TEAM_COOKIE);

  if (requestedTeamId) {
    return await findTeam(supabase, "id", requestedTeamId);
  }

  if (requestedTeamSlug) {
    return await findTeam(supabase, "slug", requestedTeamSlug);
  }

  if (activeTeamId) {
    const activeTeam = await findTeam(supabase, "id", activeTeamId);
    if (
      activeTeam &&
      (await hasAdminMembership(supabase, userId, activeTeam.id))
    ) {
      return activeTeam;
    }
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("default_team_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.default_team_id) {
    const defaultTeam = await findTeam(supabase, "id", profile.default_team_id);
    if (
      defaultTeam &&
      (await hasAdminMembership(supabase, userId, defaultTeam.id))
    ) {
      return defaultTeam;
    }
  }

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .eq("member_type", "human")
    .eq("active", true)
    .in("role", ["owner", "admin"])
    .order("joined_at", { ascending: true })
    .limit(1);

  const firstTeamId = memberships?.[0]?.team_id;
  return firstTeamId ? await findTeam(supabase, "id", firstTeamId) : null;
}

async function hasAdminMembership(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("member_type", "human")
    .eq("active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  return Boolean(data);
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

function requestCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const pair of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = pair.trim().split("=");
    if (rawKey !== name) continue;

    const value = rawValue.join("=");
    if (!value) return null;

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}
