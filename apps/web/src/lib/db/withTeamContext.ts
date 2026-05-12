import "server-only";

import { serverEnv } from "@second-brain/shared/env";
import postgres, { type Sql, type TransactionSql } from "postgres";

let sql: Sql | null = null;

export function getDatabaseClient(): Sql {
  sql ??= postgres(serverEnv.SUPABASE_DATABASE_URL, {
    max: 10,
    prepare: false,
  });

  return sql;
}

export async function withTeamContext<T>(
  teamId: string,
  callback: (tx: TransactionSql) => Promise<T>,
  db: Sql = getDatabaseClient()
): Promise<T> {
  return db.begin<T>(async (tx) => {
    await tx`select set_config('app.team_id', ${teamId}, true)`;
    return callback(tx);
  }) as Promise<T>;
}

export async function currentTeamSetting(tx: Sql | TransactionSql): Promise<string | null> {
  const [row] = await tx<{ team_id: string | null }[]>`
    select nullif(current_setting('app.team_id', true), '') as team_id
  `;

  return row?.team_id ?? null;
}
