import { describe, expect, it } from "bun:test";

import { CreateNoteRequestSchema, PatchNoteRequestSchema } from "./notes.ts";

describe("note request schemas", () => {
  it("rejects whitespace-only create titles", () => {
    const result = CreateNoteRequestSchema.safeParse({ title: "   " });

    expect(result.success).toBe(false);
  });

  it("trims accepted create titles", () => {
    const result = CreateNoteRequestSchema.parse({ title: "  Project notes  " });

    expect(result.title).toBe("Project notes");
  });

  it("rejects whitespace-only patch titles", () => {
    const result = PatchNoteRequestSchema.safeParse({
      if_version: 1,
      title: " \t\n ",
    });

    expect(result.success).toBe(false);
  });
});
