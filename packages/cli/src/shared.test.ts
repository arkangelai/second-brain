import { describe, expect, it } from "bun:test";
import { NoteKindSchema, NoteSchema, ErrorCode } from "@second-brain/shared";

describe("@second-brain/shared smoke test", () => {
  it("exposes NoteKindSchema as a Zod schema", () => {
    expect(NoteKindSchema.safeParse("note").success).toBe(true);
    expect(NoteKindSchema.safeParse("not-a-real-kind").success).toBe(false);
  });

  it("validates a well-formed Note", () => {
    const now = new Date().toISOString();
    const parsed = NoteSchema.safeParse({
      id: "abc",
      kind: "note",
      title: "Hello",
      path: "01_thinking/hello.md",
      createdAt: now,
      updatedAt: now,
      tags: ["smoke"],
    });
    expect(parsed.success).toBe(true);
  });

  it("exposes ErrorCode constants", () => {
    expect(ErrorCode.VaultNotFound).toBe("VAULT_NOT_FOUND");
    expect(ErrorCode.NoteNotFound).toBe("NOTE_NOT_FOUND");
  });
});
