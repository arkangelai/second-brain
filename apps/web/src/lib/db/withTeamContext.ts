import "server-only";

import { getPool, type PoolClient } from "./pool";

export type WithTeamContextOptions = {
  // Skip the team_members membership check via app_set_team() and just set
  // app.team_id directly. Used by the agent-auth path, where the agent token
  // has already been verified by argon2id and the team_id is trusted.
  trusted?: boolean;
};

// Opens a transaction, sets `app.team_id` for the current transaction (the
// RLS scope primitive — see supabase/migrations/0001_init.sql), runs the
// callback with the txn client, then commits. On error the transaction is
// rolled back and the original error rethrown.
//
// The `is_local=true` GUC scoping means callers MUST do their team-scoped
// reads/writes through the same `client` passed to the callback — anything
// that picks up a different connection from the pool will not see the
// setting.
export async function withTeamContext<T>(
  teamId: string,
  callback: (client: PoolClient) => Promise<T>,
  options: WithTeamContextOptions = {}
): Promise<T> {
  if (!isUuid(teamId)) {
    throw new Error(`withTeamContext: teamId is not a UUID (${teamId})`);
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (options.trusted) {
      // Service-role / agent-auth path: skip the auth.uid() membership check
      // because the caller has already proven team ownership of the request.
      await client.query("SELECT set_config('app.team_id', $1, true)", [teamId]);
    } else {
      // Human path: app_set_team() verifies the caller (via auth.uid()) is a
      // member of the team before setting the GUC.
      await client.query("SELECT public.app_set_team($1::uuid)", [teamId]);
    }

    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore — the original error is what matters
    }
    throw error;
  } finally {
    client.release();
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
