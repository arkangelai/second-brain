import { describe, expect, it } from "bun:test";
import type { NotionConfig } from "../config.ts";
const publishMod = (await import("./publish.ts" + "?publish-test")) as typeof import("./publish.ts");
const {
  autoGeneratePropertyMap,
  extractDatabaseId,
  findFilenameProperty,
  findHashProperty,
  inferMappingFromProperty,
  normalizeName,
  normalizeStatus,
  schemaTypeToMappingType,
  sha256,
  shouldIncludePost,
  toUuid,
} = publishMod;

describe("sha256", () => {
  it("returns deterministic hex hash", () => {
    expect(sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});

describe("id helpers", () => {
  it("formats compact uuid", () => {
    expect(toUuid("123456781234123412341234567890ab")).toBe(
      "12345678-1234-1234-1234-1234567890ab"
    );
  });

  it("passes through invalid uuid values", () => {
    expect(toUuid("not-a-uuid")).toBe("not-a-uuid");
  });

  it("extracts database id from raw and URL input", () => {
    expect(extractDatabaseId("123456781234123412341234567890ab")).toBe(
      "12345678-1234-1234-1234-1234567890ab"
    );
    expect(
      extractDatabaseId("https://www.notion.so/123456781234123412341234567890ab?v=abc")
    ).toBe("12345678-1234-1234-1234-1234567890ab");
  });

  it("returns null on invalid id input", () => {
    expect(extractDatabaseId("")).toBeNull();
    expect(extractDatabaseId("hello")).toBeNull();
  });
});

describe("normalizers", () => {
  it("normalizes status", () => {
    expect(normalizeStatus(" Ready ")).toBe("ready");
    expect(normalizeStatus(undefined)).toBe("");
  });

  it("normalizes names", () => {
    expect(normalizeName("Last Sync Hash")).toBe("lastsynchash");
  });
});

describe("schema mapping", () => {
  it("maps supported notion types", () => {
    expect(schemaTypeToMappingType("title")).toBe("title");
    expect(schemaTypeToMappingType("select")).toBe("select");
    expect(schemaTypeToMappingType("rich_text")).toBe("rich_text");
    expect(schemaTypeToMappingType("date")).toBe("date");
    expect(schemaTypeToMappingType("url")).toBe("url");
    expect(schemaTypeToMappingType("number")).toBe("number");
  });

  it("returns null for unsupported types", () => {
    expect(schemaTypeToMappingType("multi_select")).toBeNull();
  });
});

describe("inferMappingFromProperty", () => {
  it("infers core mappings", () => {
    expect(inferMappingFromProperty("Name", "title")).toEqual({ source: "title" });
    expect(inferMappingFromProperty("Filename", "rich_text")).toEqual({
      source: "filename",
    });
    expect(inferMappingFromProperty("Last Sync Hash", "rich_text")).toEqual({
      source: "hash",
    });
    expect(inferMappingFromProperty("Status", "select")).toEqual({
      source: "metadata",
      sourceKey: "Status",
    });
  });

  it("infers pull-only metrics", () => {
    expect(inferMappingFromProperty("Impressions", "number")).toEqual({
      source: "pull-only",
      sourceKey: "Impressions",
    });
    expect(inferMappingFromProperty("What Worked", "rich_text")).toEqual({
      source: "pull-only",
      sourceKey: "What Worked",
    });
  });

  it("infers Author static mapping only for rich_text", () => {
    expect(inferMappingFromProperty("Author", "rich_text")).toEqual({
      source: "static",
      sourceKey: "Author",
    });
    expect(inferMappingFromProperty("Author", "title")).toBeNull();
  });
});

describe("autoGeneratePropertyMap", () => {
  it("generates mappings from full schema", () => {
    const map = autoGeneratePropertyMap({
      Name: { type: "title" },
      Filename: { type: "rich_text" },
      Status: { type: "select" },
      Impressions: { type: "number" },
      Author: { type: "rich_text" },
      Tags: { type: "multi_select" },
    });

    expect(map).toEqual([
      { notionProperty: "Name", notionType: "title", source: "title" },
      { notionProperty: "Filename", notionType: "rich_text", source: "filename" },
      {
        notionProperty: "Status",
        notionType: "select",
        source: "metadata",
        sourceKey: "Status",
      },
      {
        notionProperty: "Impressions",
        notionType: "number",
        source: "pull-only",
        sourceKey: "Impressions",
      },
      {
        notionProperty: "Author",
        notionType: "rich_text",
        source: "static",
        sourceKey: "Author",
      },
    ]);
  });

  it("adds title fallback if title was not inferred", () => {
    const map = autoGeneratePropertyMap({
      Name: { type: "title" },
      Unknown: { type: "rich_text" },
    });

    expect(map).toEqual([
      { notionProperty: "Name", notionType: "title", source: "title" },
    ]);
  });
});

describe("publish filtering helpers", () => {
  const notionConfig: NotionConfig = {
    databaseId: "db",
    auth: "token",
    propertyMap: [
      { notionProperty: "Filename", notionType: "rich_text", source: "filename" },
      { notionProperty: "Hash", notionType: "rich_text", source: "hash" },
    ],
  };

  it("finds filename and hash property names", () => {
    expect(findFilenameProperty(notionConfig)).toBe("Filename");
    expect(findHashProperty(notionConfig)).toBe("Hash");
  });

  it("uses default filename/hash fallback", () => {
    expect(findFilenameProperty({ ...notionConfig, propertyMap: [] })).toBe("Filename");
    expect(findHashProperty({ ...notionConfig, propertyMap: [] })).toBeUndefined();
  });

  it("shouldIncludePost in target-file mode", () => {
    expect(
      shouldIncludePost("ready", "draft", { status: undefined }, true)
    ).toBe(true);
    expect(
      shouldIncludePost("ready", "ready", { status: "ready" }, true)
    ).toBe(true);
    expect(
      shouldIncludePost("ready", "draft", { status: "ready" }, true)
    ).toBe(false);
  });

  it("shouldIncludePost in batch mode", () => {
    expect(shouldIncludePost("ready", "draft", { all: true }, false)).toBe(true);
    expect(shouldIncludePost("ready", "ready", { all: false }, false)).toBe(true);
    expect(shouldIncludePost("ready", "draft", { all: false }, false)).toBe(false);
  });
});
