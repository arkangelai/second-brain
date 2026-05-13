import { describe, expect, it, mock } from "bun:test";

type TeamMemberRow = {
  team_id: string;
  user_id: string;
  member_type: "human" | "agent";
  role: "owner" | "admin" | "member";
  active: boolean;
  joined_at: string;
};

type TeamRow = {
  id: string;
  slug: string;
  name: string;
};

type SupabaseStub = {
  client: {
    auth: {
      getUser: () => { data: { user: { id: string } }; error: null };
    };
    from: (table: string) => unknown;
  };
};

let supabaseStub: SupabaseStub;

mock.module("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: () => supabaseStub.client,
}));

const { resolveAdminContext } = await import("./admin");

describe("resolveAdminContext", () => {
  it("falls back to an active owner/admin human membership", async () => {
    supabaseStub = createSupabaseStub({
      teamMembers: [
        {
          team_id: "old-member-team",
          user_id: "user-id",
          member_type: "human",
          role: "member",
          active: true,
          joined_at: "2024-01-01T00:00:00Z",
        },
        {
          team_id: "inactive-owner-team",
          user_id: "user-id",
          member_type: "human",
          role: "owner",
          active: false,
          joined_at: "2024-01-02T00:00:00Z",
        },
        {
          team_id: "admin-team",
          user_id: "user-id",
          member_type: "human",
          role: "admin",
          active: true,
          joined_at: "2024-01-03T00:00:00Z",
        },
      ],
      teams: [
        { id: "old-member-team", slug: "old-member", name: "Old Member" },
        {
          id: "inactive-owner-team",
          slug: "inactive-owner",
          name: "Inactive Owner",
        },
        { id: "admin-team", slug: "admin", name: "Admin Team" },
      ],
    });

    const context = await resolveAdminContext(
      new Request("http://localhost/api/admin/agents", {
        headers: { authorization: "Bearer valid-token" },
      }),
    );

    expect("team" in context && context.team.id).toBe("admin-team");
    expect("role" in context && context.role).toBe("admin");
  });
});

function createSupabaseStub({
  teamMembers,
  teams,
}: {
  teamMembers: TeamMemberRow[];
  teams: TeamRow[];
}): SupabaseStub {
  return {
    client: {
      auth: {
        getUser: () => ({ data: { user: { id: "user-id" } }, error: null }),
      },
      from(table: string) {
        const filters: Array<{ column: string; value: unknown }> = [];
        const inFilters: Array<{ column: string; values: unknown[] }> = [];
        let limitCount: number | null = null;

        const query: any = {
          select() {
            return query;
          },
          eq(column: string, value: unknown) {
            filters.push({ column, value });
            return query;
          },
          in(column: string, values: unknown[]) {
            inFilters.push({ column, values });
            return query;
          },
          order() {
            return query;
          },
          limit(count: number) {
            limitCount = count;
            return queryResult();
          },
          maybeSingle() {
            return singleResult();
          },
        };

        function queryResult() {
          if (table !== "team_members") {
            throw new Error(`Unexpected limit() on ${table}`);
          }

          const rows = filterRows(teamMembers).sort((a, b) =>
            a.joined_at.localeCompare(b.joined_at),
          );

          return {
            data: typeof limitCount === "number" ? rows.slice(0, limitCount) : rows,
            error: null,
          };
        }

        function singleResult() {
          if (table === "user_profiles") {
            return { data: null, error: null };
          }

          if (table === "teams") {
            return { data: filterRows(teams)[0] ?? null, error: null };
          }

          if (table === "team_members") {
            return { data: filterRows(teamMembers)[0] ?? null, error: null };
          }

          throw new Error(`Unexpected maybeSingle() on ${table}`);
        }

        function filterRows<Row extends Record<string, unknown>>(rows: Row[]) {
          return rows.filter((row) => {
            const matchesEquals = filters.every(
              ({ column, value }) => row[column] === value,
            );
            const matchesIn = inFilters.every(({ column, values }) =>
              values.includes(row[column]),
            );

            return matchesEquals && matchesIn;
          });
        }

        return query;
      },
    },
  };
}
