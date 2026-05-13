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
    team: { id: "team-id" },
    user: { id: "user-id" },
    role: "owner",
  }),
}));

mock.module("@/lib/auth/agentAuth", () => ({
  logAgentEvent: mock(() => Promise.resolve()),
}));

const { POST } = await import("./[id]/revoke/route");

describe("POST /api/admin/agents/[id]/revoke", () => {
  it("rejects malformed agent ids before querying UUID columns", async () => {
    queriedTables = [];

    const response = await POST(
      new Request("http://localhost/api/admin/agents/nope/revoke"),
      {
        params: Promise.resolve({ id: "nope" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid agent id" });
    expect(queriedTables).toEqual([]);
  });
});
