import { describe, expect, it, mock } from "bun:test";

let queriedTables: string[] = [];

const supabase = {
  from(table: string) {
    queriedTables.push(table);
    throw new Error(`Unexpected query against ${table}`);
  },
};

mock.module("@/lib/auth/admin", () => ({
  resolveAdminContext: () => ({
    supabase,
    team: { id: "team-id", slug: "team-slug" },
    user: { id: "user-id" },
    role: "owner",
  }),
}));

mock.module("@/lib/auth/agentAuth", () => ({
  logAgentEvent: mock(() => Promise.resolve()),
}));

mock.module("@/lib/auth/agentKeys", () => ({
  generateKey: mock(() => ({
    plaintext: "sb_live_team_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    prefix: "sb_live_team_abcdefgh",
  })),
  hashKey: mock(() => Promise.resolve("hashed-key")),
}));

const { POST } = await import("./route");

describe("POST /api/admin/agents", () => {
  it("rejects malformed scopes before creating agent rows", async () => {
    queriedTables = [];

    const response = await POST(
      new Request("http://localhost/api/admin/agents", {
        method: "POST",
        body: JSON.stringify({
          name: "Broken agent",
          scopes: [],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Scopes must match the agent scopes schema",
    });
    expect(queriedTables).toEqual([]);
  });
});
