import "server-only";

import { Pool, type PoolClient, type PoolConfig } from "pg";

import { serverEnv } from "@second-brain/shared/env";

// Module-level singleton. In a serverless deploy (Vercel Fluid Compute) the
// same Pool is reused across invocations on the same warm instance, so the
// pool stays small. Use the Supabase transaction-pooler URI in SUPABASE_DB_URL
// so connection setup is cheap and SET LOCAL still scopes correctly inside
// a single transaction.
let pool: Pool | null = null;

function buildPool(): Pool {
  const connectionString = serverEnv.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error(
      "SUPABASE_DB_URL is not set. withTeamContext needs a direct Postgres connection to open a transaction and SET LOCAL app.team_id."
    );
  }

  const config: PoolConfig = {
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    // Supabase exposes TLS on its pooler; node-postgres rejects unknown CAs
    // by default. Supabase's certs chain to a public CA so the simplest
    // posture is to leave verification on. If users override the cert path
    // they can set PGSSLMODE/PGSSLROOTCERT in their environment.
    ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: true },
  };

  return new Pool(config);
}

export function getPool(): Pool {
  pool ??= buildPool();
  return pool;
}

// Test-only hook: clear the cached pool so a test can swap the env var
// before the next call to getPool(). Production code should never call this.
export async function __resetPoolForTests(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export type { PoolClient };
