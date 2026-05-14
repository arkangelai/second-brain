import { describe, expect, it } from "bun:test";

import { matchScope, scopeTemplates } from "./scopes.ts";

describe("matchScope", () => {
  const writer = scopeTemplates.writer;
  const reader = scopeTemplates.reader;

  it("allows reads on any path for reader scope", () => {
    expect(matchScope(reader, "00_inbox/anything.md", "get")).toEqual({
      allowed: true,
    });
    expect(matchScope(reader, "deep/nested/dir/file.md", "search")).toEqual({
      allowed: true,
    });
  });

  it("denies writes for reader scope (op_not_allowed)", () => {
    expect(matchScope(reader, "00_inbox/x.md", "create")).toEqual({
      allowed: false,
      reason: "op_not_allowed",
    });
  });

  it("allows writes inside write_paths for writer scope", () => {
    expect(matchScope(writer, "01_thinking/notes/today.md", "create")).toEqual({
      allowed: true,
    });
    expect(matchScope(writer, "00_inbox/dropped.md", "create")).toEqual({
      allowed: true,
    });
  });

  it("denies writes outside write_paths (path_not_allowed)", () => {
    expect(matchScope(writer, "04_archive/old.md", "create")).toEqual({
      allowed: false,
      reason: "path_not_allowed",
    });
  });

  it("allows append on append_paths for writer scope", () => {
    expect(matchScope(writer, "01_thinking/journal.md", "append")).toEqual({
      allowed: true,
    });
  });

  it("falls back to write_paths for append when append_paths miss", () => {
    expect(matchScope(writer, "00_inbox/log.md", "append")).toEqual({
      allowed: true,
    });
  });

  it("normalizes leading ./ and slashes", () => {
    expect(matchScope(writer, "./01_thinking/notes/x.md", "create")).toEqual({
      allowed: true,
    });
    expect(matchScope(writer, "01_thinking\\notes\\x.md", "create")).toEqual({
      allowed: true,
    });
  });

  it("canonicalizes paths before matching globs", () => {
    expect(matchScope(writer, "01_thinking/notes/../notes/x.md", "create")).toEqual({
      allowed: true,
    });
    expect(matchScope(writer, "01_thinking/notes/../../04_archive/x.md", "create")).toEqual({
      allowed: false,
      reason: "path_not_allowed",
    });
  });

  it("rejects paths that traverse above the scoped root", () => {
    expect(matchScope(reader, "../outside.md", "get")).toEqual({
      allowed: false,
      reason: "path_not_allowed",
    });
    expect(matchScope(reader, "01_thinking/../../outside.md", "get")).toEqual({
      allowed: false,
      reason: "path_not_allowed",
    });
  });

  it("denies op when ops list is empty", () => {
    const noOps = { ...reader, ops: [] };
    expect(matchScope(noOps, "anywhere.md", "get")).toEqual({
      allowed: false,
      reason: "op_not_allowed",
    });
  });

  it("denies path when path glob list is empty", () => {
    const writerNoWrites = { ...writer, write_paths: [] };
    expect(matchScope(writerNoWrites, "01_thinking/notes/x.md", "create")).toEqual({
      allowed: false,
      reason: "path_not_allowed",
    });
  });
});
