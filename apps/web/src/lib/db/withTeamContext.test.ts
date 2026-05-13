// Integration test for withTeamContext. Skipped unless SUPABASE_DB_URL is set
// — it needs a real Postgres connection (Supabase pooler or local supabase
// start). Run with: SUPABASE_DB_URL=... bun test withTeamContext.test.ts

import { afterAll, describe, expect, it } from "bun:test";

import { __resetPoolForTests, getPool } from "./pool";
import { withTeamContext } from "./withTeamContext";

const dbUrl = process.env.SUPABASE_DB_URL;
const TEST_TEAM_ID = "00000000-0000-0000-0000-0000000000aa";

const describeIfDb = dbUrl ? describe : describe.skip;

describe("withTeamContext validation", () => {
  it("requires a user id for the default human path", async () => {
    await expect(
      withTeamContext(TEST_TEAM_ID, async () => undefined),
    ).rejects.toThrow(/userId is required/);
  });

  it("rejects an invalid human user id before opening a connection", async () => {
    await expect(
      withTeamContext(TEST_TEAM_ID, async () => undefined, {
        userId: "not-a-uuid",
      }),
    ).rejects.toThrow(/userId is not a UUID/);
  });
});

describeIfDb("withTeamContext (integration)", () => {
  afterAll(async () => {
    await __resetPoolForTests();
  });

  it("sets app.team_id for the duration of the callback (trusted mode)", async () => {
    const seen = await withTeamContext(
      TEST_TEAM_ID,
      async (client) => {
        const result = await client.query<{ team_id: string }>(
          "select current_setting('app.team_id', true) as team_id",
        );
        return result.rows[0]?.team_id;
      },
      { trusted: true },
    );

    expect(seen).toBe(TEST_TEAM_ID);
  });

  it("resets app.team_id after the transaction (is_local scope)", async () => {
    await withTeamContext(
      TEST_TEAM_ID,
      async () => {
        // no-op
      },
      { trusted: true },
    );

    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await client.query<{ team_id: string | null }>(
        "select nullif(current_setting('app.team_id', true), '') as team_id",
      );
      expect(result.rows[0]?.team_id ?? null).toBeNull();
    } finally {
      client.release();
    }
  });

  it("rolls back when the callback throws", async () => {
    await expect(
      withTeamContext(
        TEST_TEAM_ID,
        async () => {
          throw new Error("boom");
        },
        { trusted: true },
      ),
    ).rejects.toThrow("boom");
  });

  it("rejects non-UUID teamId", async () => {
    await expect(
      withTeamContext("not-a-uuid", async () => undefined, { trusted: true }),
    ).rejects.toThrow(/not a UUID/);
  });
});
