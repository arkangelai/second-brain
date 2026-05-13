import { describe, expect, mock, test } from "bun:test";

const humanPrincipal = {
  kind: "human",
  id: "user-1",
  team_id: "team-1",
  team_slug: "acme",
  team_name: "Acme",
  role: "member",
} as const;

const resolveHumanPrincipal = mock(async () => humanPrincipal);
const createSupabaseAdminClient = mock(() => {
  throw new Error("agent auth should not run for non-agent bearer tokens");
});

mock.module("server-only", () => ({}));
mock.module("./human-principal", () => ({
  resolveHumanPrincipal,
}));
mock.module("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient,
}));

const { resolveRequestPrincipal } = await import("./principal");

describe("resolveRequestPrincipal", () => {
  test("falls back to human auth for non-agent bearer tokens", async () => {
    const request = {
      headers: new Headers({ authorization: "Bearer upstream-token" }),
    };

    await expect(resolveRequestPrincipal(request)).resolves.toEqual(humanPrincipal);
    expect(resolveHumanPrincipal).toHaveBeenCalledTimes(1);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
