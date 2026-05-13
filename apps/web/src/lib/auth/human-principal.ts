import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TeamRole } from "@/lib/supabase/types";

export type HumanPrincipal = {
  kind: "human";
  id: string;
  team_id: string;
  role: TeamRole;
  team_slug: string;
  team_name: string;
};

type HeaderSource = {
  get(name: string): string | null;
};

export type HumanPrincipalRequest = {
  headers: HeaderSource;
};

type HumanPrincipalRow = {
  id: string;
  team_id: string;
  role: TeamRole;
  team_slug: string;
  team_name: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolveHumanPrincipal(
  request: HumanPrincipalRequest
): Promise<HumanPrincipal | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const requestedTeamId = normalizeRequestedTeamId(request.headers.get("x-team-id"));
  if (requestedTeamId === false) return null;

  const { data, error: rpcError } = await supabase
    .rpc("app_resolve_human_principal", { requested_team: requestedTeamId })
    .maybeSingle();

  if (rpcError || !data) return null;

  return toHumanPrincipal(data);
}

function normalizeRequestedTeamId(value: string | null): string | null | false {
  if (!value) return null;
  return UUID_RE.test(value) ? value : false;
}

function toHumanPrincipal(row: HumanPrincipalRow): HumanPrincipal {
  return {
    kind: "human",
    id: row.id,
    team_id: row.team_id,
    role: row.role,
    team_slug: row.team_slug,
    team_name: row.team_name,
  };
}
