import type { User } from "@supabase/supabase-js";

import { HttpError } from "@/lib/http/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const teamRoles = ["owner", "admin", "member"] as const;
export type TeamRole = (typeof teamRoles)[number];

export interface AdminContext {
  user: User;
  team: {
    id: string;
    name: string;
    slug: string;
  };
  role: Extract<TeamRole, "owner" | "admin">;
  inviterName: string;
}

interface TeamMemberRow {
  team_id: string;
  role: TeamRole;
}

interface TeamRow {
  id: string;
  name: string;
  slug: string;
}

interface ProfileRow {
  full_name: string | null;
  default_team_id: string | null;
}

export async function requireAdminContext(
  request: Request
): Promise<AdminContext> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new HttpError(401, "Authentication required", "unauthorized");
  }

  const admin = createAdminSupabaseClient();
  const requestedTeamId = request.headers.get("x-team-id");

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("full_name, default_team_id")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    throw new HttpError(500, "Unable to load user profile", "profile_error");
  }

  let teamId =
    requestedTeamId ??
    profile?.default_team_id ??
    (await firstAdminTeamId(user.id));

  if (!teamId) {
    throw new HttpError(403, "No active team found", "team_required");
  }

  let member = await teamMembership(user.id, teamId);

  if (!requestedTeamId && !isAdminRole(member?.role)) {
    const adminTeamId = await firstAdminTeamId(user.id);

    if (adminTeamId && adminTeamId !== teamId) {
      teamId = adminTeamId;
      member = await teamMembership(user.id, teamId);
    }
  }

  if (!member || !isAdminRole(member.role)) {
    throw new HttpError(403, "Owner or admin role required", "forbidden");
  }

  const { data: team, error: teamError } = await admin
    .from("teams")
    .select("id, name, slug")
    .eq("id", teamId)
    .single<TeamRow>();

  if (teamError || !team) {
    throw new HttpError(404, "Team not found", "team_not_found");
  }

  return {
    user,
    team,
    role: member.role,
    inviterName: profile?.full_name ?? user.email ?? "A teammate",
  };
}

async function teamMembership(
  userId: string,
  teamId: string
): Promise<TeamMemberRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("team_members")
    .select("team_id, role")
    .eq("team_id", teamId)
    .eq("member_type", "human")
    .eq("user_id", userId)
    .maybeSingle<TeamMemberRow>();

  if (error) {
    throw new HttpError(500, "Unable to load team membership", "membership_error");
  }

  return data ?? null;
}

async function firstAdminTeamId(userId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("team_members")
    .select("team_id")
    .eq("member_type", "human")
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .order("joined_at", { ascending: true })
    .order("team_id", { ascending: true })
    .limit(1)
    .maybeSingle<Pick<TeamMemberRow, "team_id">>();

  if (error) {
    throw new HttpError(500, "Unable to resolve active team", "team_error");
  }

  return data?.team_id ?? null;
}

function isAdminRole(
  role: TeamRole | null | undefined
): role is Extract<TeamRole, "owner" | "admin"> {
  return role === "owner" || role === "admin";
}

export function assertCanInviteRole(
  inviterRole: Extract<TeamRole, "owner" | "admin">,
  invitedRole: TeamRole
) {
  if (invitedRole === "owner" && inviterRole !== "owner") {
    throw new HttpError(403, "Only owners can invite new owners", "forbidden");
  }
}
