import { describe, expect, it } from "bun:test";
import type { NotionConfig, PropertyMapping } from "./config.ts";
import type { ParsedPost } from "./parser.ts";
import {
  buildBlocks,
  buildProperties,
  createNotionClient,
  normalizeHeading,
  readPropertyValue,
  resolveMappingValue,
  sectionToBlocks,
  splitText,
  toPropertyValue,
} from "./notion.ts";

const basePost: ParsedPost = {
  title: "My Post",
  metadata: {
    Status: "Ready",
    Platform: "LinkedIn",
    "Publish Date": "2026-02-01",
  },
  sections: {
    "Core Idea": "Idea body",
    Draft: "Draft body",
    Extra: "Extra body",
  },
  rawContent: "",
};

function mapping(
  notionType: PropertyMapping["notionType"],
  source: PropertyMapping["source"],
  sourceKey?: string
): PropertyMapping {
  return {
    notionProperty: "X",
    notionType,
    source,
    sourceKey,
  };
}

describe("splitText", () => {
  it("returns empty for empty input", () => {
    expect(splitText("")).toEqual([]);
    expect(splitText("   ")).toEqual([]);
  });

  it("returns one chunk for short text", () => {
    expect(splitText("abc")).toEqual(["abc"]);
  });

  it("splits text into 1900-char chunks", () => {
    const input = "a".repeat(1901);
    const chunks = splitText(input);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(1900);
    expect(chunks[1]).toHaveLength(1);
  });
});

describe("sectionToBlocks", () => {
  it("creates heading_2 blocks", () => {
    const blocks = sectionToBlocks("Idea", 2, "hello");
    expect(blocks[0]).toMatchObject({
      type: "heading_2",
    });
  });

  it("creates heading_3 blocks", () => {
    const blocks = sectionToBlocks("Idea", 3, "hello");
    expect(blocks[0]).toMatchObject({
      type: "heading_3",
    });
  });

  it("returns heading only when body is empty", () => {
    const blocks = sectionToBlocks("Idea", 2, "   ");
    expect(blocks).toHaveLength(1);
  });

  it("splits paragraph chunks over Notion limit", () => {
    const blocks = sectionToBlocks("Idea", 2, "a".repeat(1901));
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toMatchObject({ type: "paragraph" });
    expect(blocks[2]).toMatchObject({ type: "paragraph" });
  });
});

describe("normalizeHeading", () => {
  it("trims and lowercases", () => {
    expect(normalizeHeading("  Core Idea  ")).toBe("core idea");
  });
});

describe("toPropertyValue", () => {
  it("handles title", () => {
    expect(toPropertyValue(mapping("title", "title"), "Hello")).toMatchObject({
      title: [{ text: { content: "Hello" } }],
    });
  });

  it("handles select", () => {
    expect(toPropertyValue(mapping("select", "metadata"), "Ready")).toEqual({
      select: { name: "Ready" },
    });
    expect(toPropertyValue(mapping("select", "metadata"), "")).toEqual({
      select: null,
    });
  });

  it("handles rich_text", () => {
    expect(toPropertyValue(mapping("rich_text", "metadata"), "X")).toMatchObject({
      rich_text: [{ text: { content: "X" } }],
    });
  });

  it("handles date", () => {
    expect(toPropertyValue(mapping("date", "metadata"), "2026-02-01")).toEqual({
      date: { start: "2026-02-01" },
    });
  });

  it("handles url", () => {
    expect(toPropertyValue(mapping("url", "metadata"), "https://x.com")).toEqual({
      url: "https://x.com",
    });
  });

  it("handles number", () => {
    expect(toPropertyValue(mapping("number", "metadata"), "42")).toEqual({
      number: 42,
    });
    expect(toPropertyValue(mapping("number", "metadata"), "NaN")).toEqual({
      number: null,
    });
  });
});

describe("resolveMappingValue", () => {
  const config: NotionConfig = {
    databaseId: "db",
    auth: "token",
    defaults: {
      Status: "Draft",
      Author: "Jane",
      X: "default",
    },
    propertyMap: [],
  };

  it("resolves metadata source", () => {
    const value = resolveMappingValue(
      basePost,
      { notionProperty: "Status", notionType: "select", source: "metadata" },
      "a.md",
      "h",
      config
    );
    expect(value).toBe("Ready");
  });

  it("resolves metadata with sourceKey", () => {
    const value = resolveMappingValue(
      basePost,
      {
        notionProperty: "S",
        notionType: "select",
        source: "metadata",
        sourceKey: "Platform",
      },
      "a.md",
      "h",
      config
    );
    expect(value).toBe("LinkedIn");
  });

  it("falls back to defaults for missing metadata", () => {
    const value = resolveMappingValue(
      basePost,
      { notionProperty: "X", notionType: "select", source: "metadata" },
      "a.md",
      "h",
      config
    );
    expect(value).toBe("default");
  });

  it("resolves filename/title/hash/static/pull-only", () => {
    expect(
      resolveMappingValue(
        basePost,
        { notionProperty: "Filename", notionType: "rich_text", source: "filename" },
        "a.md",
        "h",
        config
      )
    ).toBe("a.md");
    expect(
      resolveMappingValue(
        basePost,
        { notionProperty: "Title", notionType: "title", source: "title" },
        "a.md",
        "h",
        config
      )
    ).toBe("My Post");
    expect(
      resolveMappingValue(
        basePost,
        { notionProperty: "Hash", notionType: "rich_text", source: "hash" },
        "a.md",
        "h123",
        config
      )
    ).toBe("h123");
    expect(
      resolveMappingValue(
        basePost,
        { notionProperty: "Author", notionType: "rich_text", source: "static", sourceKey: "Author" },
        "a.md",
        "h",
        config
      )
    ).toBe("Jane");
    expect(
      resolveMappingValue(
        basePost,
        { notionProperty: "Pull", notionType: "rich_text", source: "pull-only" },
        "a.md",
        "h",
        config
      )
    ).toBe("");
  });
});

describe("readPropertyValue", () => {
  it("handles title and rich_text", () => {
    expect(readPropertyValue({ type: "title", title: [{ plain_text: "A" }] })).toBe("A");
    expect(
      readPropertyValue({ type: "rich_text", rich_text: [{ plain_text: "B" }] })
    ).toBe("B");
  });

  it("handles select/status/url/number/date", () => {
    expect(readPropertyValue({ type: "select", select: { name: "Ready" } })).toBe("Ready");
    expect(readPropertyValue({ type: "status", status: { name: "Done" } })).toBe("Done");
    expect(readPropertyValue({ type: "url", url: "https://x.com" })).toBe("https://x.com");
    expect(readPropertyValue({ type: "number", number: 5 })).toBe("5");
    expect(readPropertyValue({ type: "date", date: { start: "2026-02-01" } })).toBe(
      "2026-02-01"
    );
  });

  it("handles checkbox and multi_select", () => {
    expect(readPropertyValue({ type: "checkbox", checkbox: true })).toBe("true");
    expect(
      readPropertyValue({
        type: "multi_select",
        multi_select: [{ name: "A" }, { name: "B" }],
      })
    ).toBe("A, B");
  });

  it("returns empty for null/unknown values", () => {
    expect(readPropertyValue(null)).toBe("");
    expect(readPropertyValue({ type: "people" })).toBe("");
  });
});

describe("buildProperties", () => {
  it("builds all non pull-only properties", () => {
    const config: NotionConfig = {
      databaseId: "db",
      auth: "token",
      propertyMap: [
        { notionProperty: "Name", notionType: "title", source: "title" },
        { notionProperty: "Filename", notionType: "rich_text", source: "filename" },
        { notionProperty: "Hash", notionType: "rich_text", source: "hash" },
        { notionProperty: "Status", notionType: "select", source: "metadata", sourceKey: "Status" },
        { notionProperty: "Impressions", notionType: "number", source: "pull-only", sourceKey: "Impressions" },
      ],
    };

    const properties = buildProperties(basePost, "my-post.md", "abc123", config);
    expect(Object.keys(properties).sort()).toEqual([
      "Filename",
      "Hash",
      "Name",
      "Status",
    ]);
  });
});

describe("buildBlocks", () => {
  it("uses mapped sections first, then unmapped headings", () => {
    const config: NotionConfig = {
      databaseId: "db",
      auth: "token",
      propertyMap: [],
      bodyMap: {
        sections: [
          { markdownHeading: "Draft", notionHeading: "Draft Section", headingLevel: 3 },
          { markdownHeading: "Core Idea", notionHeading: "Idea", headingLevel: 2 },
        ],
      },
    };

    const blocks = buildBlocks(basePost, config);
    expect(blocks[0]).toMatchObject({ type: "heading_3" });
    expect(blocks[2]).toMatchObject({ type: "heading_2" });
    expect(blocks.some((b) => (b as { heading_2?: { rich_text?: any[] } }).heading_2?.rich_text?.[0]?.text?.content === "Extra")).toBe(
      true
    );
  });

  it("skips empty sections", () => {
    const config: NotionConfig = {
      databaseId: "db",
      auth: "token",
      propertyMap: [],
      bodyMap: { sections: [] },
    };
    const post: ParsedPost = {
      ...basePost,
      sections: { Empty: "   " },
    };
    const blocks = buildBlocks(post, config);
    expect(blocks).toEqual([]);
  });
});

describe("createNotionClient", () => {
  it("throws if auth is empty", () => {
    expect(() =>
      createNotionClient({
        databaseId: "db",
        auth: "",
        propertyMap: [],
      })
    ).toThrow("Notion auth token is missing");
  });

  it("creates a client with auth", () => {
    const client = createNotionClient({
      databaseId: "db",
      auth: "token",
      propertyMap: [],
    });
    expect(client).toBeDefined();
  });
});
