import { describe, expect, it } from "bun:test";

import {
  allowedAppendSections,
  extractWikiLinks,
  insertWikiLink,
  normalizeFolder,
  normalizeSlug,
  slugifyTitle,
} from "./markdown";

describe("notes markdown helpers", () => {
  it("generates stable kebab slugs without diacritics", () => {
    expect(slugifyTitle("Crème Brûlée Notes")).toBe("creme-brulee-notes");
    expect(normalizeSlug("Already Good.md")).toBe("already-good");
  });

  it("normalizes folders without allowing parent traversal", () => {
    expect(normalizeFolder("./01_thinking/notes")).toBe("01_thinking/notes");
    expect(normalizeFolder("../escape")).toBe("00_inbox");
  });

  it("extracts wiki links outside code fences", () => {
    expect(
      extractWikiLinks("See [[alpha]]\n```\n[[ignored]]\n```\nAnd [[beta|Beta]]"),
    ).toEqual(["alpha", "beta"]);
  });

  it("inserts a wiki link near a context phrase outside markdown links", () => {
    const result = insertWikiLink(
      "A paragraph about quality.",
      "quality-systems",
      "quality",
    );

    expect(result.changed).toBe(true);
    expect(result.body).toBe("A paragraph about quality [[quality-systems]].");
  });

  it("falls back to a Related section and is idempotent", () => {
    const first = insertWikiLink("Body", "target-note");
    const second = insertWikiLink(first.body, "target-note");

    expect(first.changed).toBe(true);
    expect(first.body).toBe("Body\n\n## Related\n- [[target-note]]");
    expect(second.changed).toBe(false);
  });

  it("allows custom append sections alongside defaults", () => {
    expect(allowedAppendSections({ append_sections: ["decisions"] })).toContain(
      "decisions",
    );
  });
});
