import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json, TeamRole } from "@/lib/supabase/types";

export type HumanPrincipal = {
  kind: "human";
  id: string;
  team_id: string;
  role: TeamRole;
};

type HeaderSource = {
  get(name: string): string | null;
};

export type HumanPrincipalRequest = {
  headers: HeaderSource;
};

type MembershipRow = {
  team_id: string;
  member_id: string;
  member_type: "human" | "agent";
  user_id: string | null;
  role: TeamRole;
  scopes: Json;
  active: boolean;
  revoked_at: string | null;
};

export async function resolveHumanPrincipal(
  request: HumanPrincipalRequest
): Promise<HumanPrincipal | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const requestedTeamId = request.headers.get("x-team-id");

  if (requestedTeamId) {
    return toHumanPrincipal(user.id, await findHumanMembership(user.id, requestedTeamId));
  }

  const defaultTeamId = await getDefaultTeamId(user.id);
  const membership =
    (defaultTeamId ? await findHumanMembership(user.id, defaultTeamId) : null) ??
    (await findHumanMembership(user.id, null));

  return toHumanPrincipal(user.id, membership);
}

async function getDefaultTeamId(userId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("default_team_id")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.default_team_id ?? null;
}

async function findHumanMembership(
  userId: string,
  teamId: string | null
): Promise<MembershipRow | null> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("team_members")
    .select("team_id, member_id, member_type, user_id, role, scopes, active, revoked_at")
    .eq("user_id", userId)
    .eq("member_type", "human")
    .eq("active", true)
    .is("revoked_at", null)
    .order("joined_at", { ascending: true })
    .limit(1);

  if (teamId) {
    query = query.eq("team_id", teamId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  return data;
}

function toHumanPrincipal(userId: string, membership: MembershipRow | null): HumanPrincipal | null {
  if (!membership) return null;

  return {
    kind: "human",
    id: userId,
    team_id: membership.team_id,
    role: membership.role,
  };
}
