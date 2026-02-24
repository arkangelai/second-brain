import { describe, expect, it } from "bun:test";
import { parsePipelinePost, updatePostMetadata } from "./parser.ts";

describe("parsePipelinePost", () => {
  it("extracts H1 title", () => {
    const parsed = parsePipelinePost("# Hello World\n\nbody");
    expect(parsed.title).toBe("Hello World");
  });

  it("defaults to Untitled when no H1 exists", () => {
    const parsed = parsePipelinePost("no h1");
    expect(parsed.title).toBe("Untitled");
  });

  it("parses metadata before divider", () => {
    const parsed = parsePipelinePost("**Status:** Ready\n**Pillar:** Coding\n---\n# T");
    expect(parsed.metadata).toEqual({
      Status: "Ready",
      Pillar: "Coding",
    });
  });

  it("ignores non-metadata lines before divider", () => {
    const parsed = parsePipelinePost("hello\n**Status:** Ready\n---\n# T");
    expect(parsed.metadata).toEqual({ Status: "Ready" });
  });

  it("parses H2 sections after divider", () => {
    const parsed = parsePipelinePost(
      "# Title\n---\n## Core Idea\nfirst\n\n## Draft\nsecond"
    );

    expect(parsed.sections).toEqual({
      "Core Idea": "first",
      Draft: "second",
    });
  });

  it("parses sections even without divider", () => {
    const parsed = parsePipelinePost("# Title\n## Notes\nabc");
    expect(parsed.sections).toEqual({ Notes: "abc" });
  });

  it("handles empty section bodies", () => {
    const parsed = parsePipelinePost("# Title\n---\n## Notes\n\n## Draft\ntext");
    expect(parsed.sections).toEqual({
      Notes: "",
      Draft: "text",
    });
  });

  it("handles Windows line endings", () => {
    const parsed = parsePipelinePost("# Title\r\n---\r\n## Notes\r\ntext");
    expect(parsed.sections).toEqual({ Notes: "text" });
  });

  it("returns rawContent unchanged", () => {
    const content = "# T\n---\n## A\nb";
    const parsed = parsePipelinePost(content);
    expect(parsed.rawContent).toBe(content);
  });
});

describe("updatePostMetadata", () => {
  it("updates existing metadata keys", () => {
    const content = "**Status:** Draft\n---\n# Title";
    const next = updatePostMetadata(content, { Status: "Ready" });
    expect(next).toContain("**Status:** Ready");
  });

  it("inserts new keys before divider", () => {
    const content = "**Status:** Draft\n---\n# Title";
    const next = updatePostMetadata(content, { Platform: "LinkedIn" });
    expect(next).toBe("**Status:** Draft\n**Platform:** LinkedIn\n---\n# Title");
  });

  it("updates and inserts keys in one pass", () => {
    const content = "**Status:** Draft\n---\n# Title";
    const next = updatePostMetadata(content, {
      Status: "Ready",
      Platform: "X",
    });
    expect(next).toBe("**Status:** Ready\n**Platform:** X\n---\n# Title");
  });

  it("returns unchanged content when updates are empty", () => {
    const content = "**Status:** Draft\n---\n# Title";
    expect(updatePostMetadata(content, {})).toBe(content);
  });

  it("returns unchanged content when divider is missing", () => {
    const content = "**Status:** Draft\n# Title";
    expect(updatePostMetadata(content, { Status: "Ready" })).toBe(content);
  });
});
