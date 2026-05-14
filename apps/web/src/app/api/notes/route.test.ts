import { describe, expect, it, mock } from "bun:test";

let listNotesCalls = 0;

mock.module("@/lib/auth/principal", () => ({
  resolveRequestPrincipal: () => ({
    kind: "human",
    id: "00000000-0000-0000-0000-000000000001",
    team_id: "00000000-0000-0000-0000-0000000000aa",
    role: "member",
  }),
}));

mock.module("@/lib/notes/service", () => ({
  createNote: mock(),
  listNotes: mock(() => {
    listNotesCalls += 1;
    return Promise.resolve({
      ok: true,
      value: {
        notes: [],
        next_updated_before: null,
        next_updated_before_id: null,
      },
    });
  }),
}));

const { GET } = await import("./route");

describe("GET /api/notes", () => {
  it("rejects malformed updated_before before querying notes", async () => {
    listNotesCalls = 0;

    const response = await GET(new Request("http://localhost/api/notes?updated_before=abc"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid 'updated_before' parameter; expected an ISO 8601 timestamp",
    });
    expect(listNotesCalls).toBe(0);
  });

  it("rejects malformed updated_before_id before querying notes", async () => {
    listNotesCalls = 0;

    const response = await GET(
      new Request(
        "http://localhost/api/notes?updated_before=2026-05-14T00%3A00%3A00.000Z&updated_before_id=nope",
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid 'updated_before_id' parameter; expected a UUID",
    });
    expect(listNotesCalls).toBe(0);
  });
});
