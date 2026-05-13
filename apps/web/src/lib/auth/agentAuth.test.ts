import { describe, expect, it, mock } from "bun:test";

import { generateKey, hashKey } from "./agentKeys";

type InsertedRow = {
  table: string;
  payload: Record<string, unknown>;
};

type SupabaseStub = {
  client: {
    from: (table: string) => unknown;
  };
  inserts: InsertedRow[];
  updates: InsertedRow[];
};

let supabaseStub: SupabaseStub;

mock.module("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: () => supabaseStub.client,
}));

const { authenticateAgentRequest } = await import("./agentAuth");

describe("authenticateAgentRequest", () => {
  it("rejects expired API keys before updating usage", async () => {
    const key = generateKey("dev");
    const keyHash = await hashKey(key.plaintext);
    supabaseStub = createSupabaseStub({
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      keyHash,
    });

    const auth = await authenticateAgentRequest(
      new Request("http://localhost/api/whoami", {
        headers: {
          authorization: `Bearer ${key.plaintext}`,
          "user-agent": "bun-test",
        },
      }),
    );

    const failure = supabaseStub.inserts.find(
      (insert) => insert.table === "agent_auth_failures",
    )?.payload;

    expect(auth).toBeNull();
    expect(failure?.failure_reason).toBe("expired_key");
    expect(failure?.key_id).toBe("key-id");
    expect(failure?.key_prefix).toBe(key.prefix);
    expect(supabaseStub.updates).toEqual([]);
  });
});

function createSupabaseStub({
  expiresAt,
  keyHash,
}: {
  expiresAt: string;
  keyHash: string;
}): SupabaseStub {
  const inserts: InsertedRow[] = [];
  const updates: InsertedRow[] = [];

  return {
    client: {
      from(table: string) {
        let selectedColumns = "";
        const query: any = {
          select(columns: string) {
            selectedColumns = columns;
            return query;
          },
          eq() {
            return query;
          },
          order() {
            return query;
          },
          limit() {
            return query;
          },
          gte() {
            return query;
          },
          maybeSingle() {
            if (table === "teams") {
              return {
                data: { id: "team-id", slug: "dev", name: "Dev Team" },
                error: null,
              };
            }

            if (table === "team_member_api_keys") {
              if (!selectedColumns.includes("expires_at")) {
                throw new Error("team_member_api_keys query must select expires_at");
              }

              return {
                data: {
                  id: "key-id",
                  team_id: "team-id",
                  member_id: "agent-id",
                  name: "dev-cli primary key",
                  key_hash: keyHash,
                  scopes: ["read"],
                  revoked_at: null,
                  expires_at: expiresAt,
                },
                error: null,
              };
            }

            if (table === "team_members") {
              return {
                data: {
                  member_id: "agent-id",
                  display_name: "dev-cli",
                  scopes: ["read"],
                  active: true,
                  revoked_at: null,
                },
                error: null,
              };
            }

            throw new Error(`Unexpected maybeSingle() on ${table}`);
          },
          insert(payload: Record<string, unknown>) {
            inserts.push({ table, payload });
            return { data: null, error: null };
          },
          update(payload: Record<string, unknown>) {
            updates.push({ table, payload });
            return query;
          },
        };

        return query;
      },
    },
    inserts,
    updates,
  };
}
