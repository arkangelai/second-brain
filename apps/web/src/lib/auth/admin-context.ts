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

  const teamId =
    requestedTeamId ?? profile?.default_team_id ?? (await firstTeamId(user.id));

  if (!teamId) {
    throw new HttpError(403, "No active team found", "team_required");
  }

  const { data: member, error: memberError } = await admin
    .from("team_members")
    .select("team_id, role")
    .eq("team_id", teamId)
    .eq("member_type", "human")
    .eq("user_id", user.id)
    .maybeSingle<TeamMemberRow>();

  if (memberError) {
    throw new HttpError(500, "Unable to load team membership", "membership_error");
  }

  if (!member || (member.role !== "owner" && member.role !== "admin")) {
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

async function firstTeamId(userId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("team_members")
    .select("team_id")
    .eq("member_type", "human")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<Pick<TeamMemberRow, "team_id">>();

  if (error) {
    throw new HttpError(500, "Unable to resolve active team", "team_error");
  }

  return data?.team_id ?? null;
}

export function assertCanInviteRole(
  inviterRole: Extract<TeamRole, "owner" | "admin">,
  invitedRole: TeamRole
) {
  if (invitedRole === "owner" && inviterRole !== "owner") {
    throw new HttpError(403, "Only owners can invite new owners", "forbidden");
  }
}
