import { Client } from "@notionhq/client";
import type { NotionConfig, PropertyMapping } from "./config.ts";
import type { ParsedPost } from "./parser.ts";
import { DEFAULT_NOTION_BODY_MAP } from "./config.ts";

const NOTION_REQUEST_DELAY_MS = 350;
const NOTION_TEXT_CHUNK = 1900;

let lastNotionCallAt = 0;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function callNotion<T>(fn: () => Promise<T>): Promise<T> {
  const elapsed = Date.now() - lastNotionCallAt;
  if (elapsed < NOTION_REQUEST_DELAY_MS) {
    await sleep(NOTION_REQUEST_DELAY_MS - elapsed);
  }

  const result = await fn();
  lastNotionCallAt = Date.now();
  return result;
}

function plainText(content: string) {
  return [{ type: "text", text: { content } }];
}

function splitText(input: string): string[] {
  const value = input.trim();
  if (!value) return [];

  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += NOTION_TEXT_CHUNK) {
    chunks.push(value.slice(i, i + NOTION_TEXT_CHUNK));
  }

  return chunks;
}

function sectionToBlocks(heading: string, level: 2 | 3, body: string): Record<string, unknown>[] {
  const headingType = level === 2 ? "heading_2" : "heading_3";
  const blocks: Record<string, unknown>[] = [
    {
      object: "block",
      type: headingType,
      [headingType]: {
        rich_text: plainText(heading),
      },
    },
  ];

  const paragraphs = body
    .split(/\n\s*\n/g)
    .map((text) => text.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return blocks;
  }

  for (const paragraph of paragraphs) {
    for (const chunk of splitText(paragraph)) {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: plainText(chunk),
        },
      });
    }
  }

  return blocks;
}

function toPropertyValue(
  mapping: PropertyMapping,
  value: string | undefined
): Record<string, unknown> {
  const normalized = (value || "").trim();

  switch (mapping.notionType) {
    case "title":
      return { title: normalized ? plainText(normalized) : [] };

    case "select":
      return { select: normalized ? { name: normalized } : null };

    case "rich_text":
      return { rich_text: normalized ? plainText(normalized) : [] };

    case "date":
      return { date: normalized ? { start: normalized } : null };

    case "url":
      return { url: normalized || null };

    case "number": {
      const parsed = Number(normalized);
      return { number: Number.isFinite(parsed) ? parsed : null };
    }
  }
}

function resolveMappingValue(
  post: ParsedPost,
  mapping: PropertyMapping,
  filename: string,
  hash: string,
  config: NotionConfig
): string {
  switch (mapping.source) {
    case "metadata": {
      const key = mapping.sourceKey || mapping.notionProperty;
      return post.metadata[key] || config.defaults?.[mapping.notionProperty] || "";
    }

    case "filename":
      return filename;

    case "title":
      return post.title;

    case "hash":
      return hash;

    case "static":
      if (mapping.sourceKey) {
        return config.defaults?.[mapping.sourceKey] || mapping.sourceKey;
      }
      return config.defaults?.[mapping.notionProperty] || "";

    case "pull-only":
      return "";
  }
}

export function createNotionClient(config: NotionConfig): Client {
  if (!config.auth) {
    throw new Error(
      "Notion auth token is missing. Set integrations.notion.auth to an env reference like \"$NOTION_API_TOKEN\" and export the variable."
    );
  }

  return new Client({ auth: config.auth });
}

export function buildProperties(
  post: ParsedPost,
  filename: string,
  hash: string,
  config: NotionConfig
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  for (const mapping of config.propertyMap) {
    if (mapping.source === "pull-only") continue;

    const value = resolveMappingValue(post, mapping, filename, hash, config);
    properties[mapping.notionProperty] = toPropertyValue(mapping, value);
  }

  return properties;
}

export function buildBlocks(
  post: ParsedPost,
  config: NotionConfig
): Record<string, unknown>[] {
  const bodyMap = config.bodyMap || DEFAULT_NOTION_BODY_MAP;
  const blocks: Record<string, unknown>[] = [];

  for (const section of bodyMap.sections) {
    const text = post.sections[section.markdownHeading];
    if (!text) continue;
    blocks.push(...sectionToBlocks(section.notionHeading, section.headingLevel, text));
  }

  if (blocks.length > 0) {
    return blocks;
  }

  for (const [heading, text] of Object.entries(post.sections)) {
    if (!text.trim()) continue;
    blocks.push(...sectionToBlocks(heading, 2, text));
  }

  return blocks;
}

function readPropertyValue(property: any): string {
  if (!property || typeof property !== "object") return "";

  switch (property.type) {
    case "title":
      return (property.title || []).map((item: any) => item.plain_text || "").join("").trim();

    case "rich_text":
      return (property.rich_text || []).map((item: any) => item.plain_text || "").join("").trim();

    case "select":
      return property.select?.name || "";

    case "status":
      return property.status?.name || "";

    case "url":
      return property.url || "";

    case "number":
      return property.number == null ? "" : String(property.number);

    case "date":
      return property.date?.start || "";

    case "checkbox":
      return property.checkbox ? "true" : "false";

    case "multi_select":
      return (property.multi_select || []).map((entry: any) => entry.name).join(", ");

    default:
      return "";
  }
}

async function listDatabasePages(
  client: Client,
  databaseId: string
): Promise<any[]> {
  const pages: any[] = [];
  let cursor: string | undefined;

  while (true) {
    const response: any = await callNotion(() =>
      client.databases.query({
        database_id: databaseId,
        start_cursor: cursor,
        page_size: 100,
      } as any)
    );

    pages.push(...response.results);

    if (!response.has_more || !response.next_cursor) {
      break;
    }

    cursor = response.next_cursor;
  }

  return pages;
}

export async function findPageByFilename(
  client: Client,
  dbId: string,
  filename: string,
  filenameProperty = "Filename"
): Promise<any | null> {
  for (const key of ["rich_text", "title"] as const) {
    try {
      const query: any =
        key === "rich_text"
          ? { property: filenameProperty, rich_text: { equals: filename } }
          : { property: filenameProperty, title: { equals: filename } };

      const response: any = await callNotion(() =>
        client.databases.query({
          database_id: dbId,
          filter: query,
          page_size: 1,
        } as any)
      );

      if (response.results.length > 0) {
        return response.results[0];
      }
    } catch {
      // fall through to full scan
    }
  }

  const pages = await listDatabasePages(client, dbId);
  for (const page of pages) {
    const value = readPropertyValue(page.properties?.[filenameProperty]);
    if (value === filename) {
      return page;
    }
  }

  return null;
}

export async function createPage(
  client: Client,
  dbId: string,
  properties: Record<string, unknown>,
  blocks: Record<string, unknown>[]
): Promise<any> {
  const firstBatch = blocks.slice(0, 100);
  const page: any = await callNotion(() =>
    client.pages.create({
      parent: { database_id: dbId },
      properties: properties as any,
      children: firstBatch as any,
    })
  );

  for (let i = 100; i < blocks.length; i += 100) {
    const batch = blocks.slice(i, i + 100);
    await callNotion(() =>
      client.blocks.children.append({
        block_id: page.id,
        children: batch as any,
      })
    );
  }

  return page;
}

async function archiveAllChildren(client: Client, pageId: string): Promise<void> {
  let cursor: string | undefined;

  while (true) {
    const response: any = await callNotion(() =>
      client.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
        page_size: 100,
      })
    );

    for (const block of response.results) {
      await callNotion(() =>
        client.blocks.update({
          block_id: block.id,
          archived: true,
        } as any)
      );
    }

    if (!response.has_more || !response.next_cursor) {
      break;
    }

    cursor = response.next_cursor;
  }
}

export async function updatePage(
  client: Client,
  pageId: string,
  properties: Record<string, unknown>,
  blocks: Record<string, unknown>[]
): Promise<void> {
  await callNotion(() =>
    client.pages.update({
      page_id: pageId,
      properties: properties as any,
    })
  );

  await archiveAllChildren(client, pageId);

  for (let i = 0; i < blocks.length; i += 100) {
    const batch = blocks.slice(i, i + 100);
    await callNotion(() =>
      client.blocks.children.append({
        block_id: pageId,
        children: batch as any,
      })
    );
  }
}

export async function getPageSyncHash(client: Client, pageId: string): Promise<string> {
  const page: any = await callNotion(() =>
    client.pages.retrieve({ page_id: pageId })
  );

  return readPropertyValue(page.properties?.["Last Sync Hash"]);
}

export async function readDatabaseSchema(
  client: Client,
  dbId: string
): Promise<Record<string, { type: string }>> {
  const database: any = await callNotion(() =>
    client.databases.retrieve({ database_id: dbId })
  );

  const schema: Record<string, { type: string }> = {};
  for (const [name, config] of Object.entries(database.properties || {})) {
    schema[name] = { type: (config as any).type };
  }

  return schema;
}

export async function readPageProperties(
  client: Client,
  pageId: string,
  propertyNames: string[]
): Promise<Record<string, string>> {
  const page: any = await callNotion(() =>
    client.pages.retrieve({ page_id: pageId })
  );

  const values: Record<string, string> = {};
  for (const name of propertyNames) {
    values[name] = readPropertyValue(page.properties?.[name]);
  }

  return values;
}

export function getPropertyValueFromPage(page: any, propertyName: string): string {
  return readPropertyValue(page?.properties?.[propertyName]);
}
