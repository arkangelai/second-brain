import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { basename, dirname, isAbsolute, join, relative } from "path";
import { createInterface } from "readline/promises";
import {
  DEFAULT_NOTION_BODY_MAP,
  resolveConfig,
  saveConfig,
  type Config,
  type NotionConfig,
  type PropertyMapping,
} from "../config.ts";
import { parsePipelinePost } from "../parser.ts";
import {
  buildBlocks,
  buildProperties,
  createNotionClient,
  createPage,
  findPageByFilename,
  getPageSyncHash,
  getPropertyValueFromPage,
  readDatabaseSchema,
  updatePage,
} from "../notion.ts";
import { bold, cyan, dim, error, log, success, warn } from "../utils.ts";

export interface PublishOptions {
  dryRun?: boolean;
  force?: boolean;
  all?: boolean;
  status?: string;
}

interface PublishSummary {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  moved: number;
}

/** @internal */
export function sha256(content: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  return hasher.digest("hex");
}

function listMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const entries = readdirSync(dir, { recursive: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relPath = String(entry);
    if (!relPath.endsWith(".md")) continue;
    files.push(join(dir, relPath));
  }

  return files.sort();
}

/** @internal */
export function normalizeStatus(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

/** @internal */
export function findFilenameProperty(config: NotionConfig): string {
  return config.propertyMap.find((item) => item.source === "filename")?.notionProperty || "Filename";
}

/** @internal */
export function findHashProperty(config: NotionConfig): string | undefined {
  return config.propertyMap.find((item) => item.source === "hash")?.notionProperty;
}

function resolveTargetFile(vaultPath: string, fileArg: string): string | null {
  const pipelineDir = join(vaultPath, "03_creating", "pipeline");
  const publishedDir = join(vaultPath, "04_published");

  if (isAbsolute(fileArg) && existsSync(fileArg)) {
    return fileArg;
  }

  const candidates = [
    join(pipelineDir, fileArg),
    join(publishedDir, fileArg),
    join(vaultPath, fileArg),
  ];

  for (const file of candidates) {
    if (existsSync(file)) return file;
  }

  return null;
}

/** @internal */
export function toUuid(value: string): string {
  const compact = value.replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(compact)) {
    return value;
  }

  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join("-");
}

/** @internal */
export function extractDatabaseId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const direct = trimmed.replace(/[-\s]/g, "");
  if (/^[0-9a-fA-F]{32}$/.test(direct)) {
    return toUuid(direct);
  }

  const match = trimmed.match(/([0-9a-fA-F]{32}|[0-9a-fA-F-]{36})/);
  if (!match) return null;

  return toUuid(match[1]);
}

/** @internal */
export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** @internal */
export function schemaTypeToMappingType(type: string): PropertyMapping["notionType"] | null {
  if (type === "title") return "title";
  if (type === "select") return "select";
  if (type === "rich_text") return "rich_text";
  if (type === "date") return "date";
  if (type === "url") return "url";
  if (type === "number") return "number";
  return null;
}

/** @internal */
export function inferMappingFromProperty(
  notionProperty: string,
  notionType: PropertyMapping["notionType"]
): Omit<PropertyMapping, "notionProperty" | "notionType"> | null {
  const n = normalizeName(notionProperty);

  if (n === "title" || n === "name") return { source: "title" };
  if (n === "filename" || n === "file") return { source: "filename" };
  if (n === "lastsynchash" || n === "synchash" || n === "hash") return { source: "hash" };
  if (n === "status") return { source: "metadata", sourceKey: "Status" };
  if (n === "platform") return { source: "metadata", sourceKey: "Platform" };
  if (n === "pillar") return { source: "metadata", sourceKey: "Pillar" };
  if (n === "structure") return { source: "metadata", sourceKey: "Structure" };
  if (n === "sourcenotes" || n === "sources") return { source: "metadata", sourceKey: "Source notes" };
  if (n === "publishedurl" || n === "url") return { source: "metadata", sourceKey: "Published URL" };
  if (n === "publishdate" || n === "publisheddate") return { source: "metadata", sourceKey: "Publish Date" };

  if (n === "impressions") return { source: "pull-only", sourceKey: "Impressions" };
  if (n === "engagement") return { source: "pull-only", sourceKey: "Engagement" };
  if (n === "whatworked") return { source: "pull-only", sourceKey: "What Worked" };
  if (n === "whatdidnt" || n === "whatdidn't") return { source: "pull-only", sourceKey: "What Didnt" };
  if (n === "remixpotential") return { source: "pull-only", sourceKey: "Remix Potential" };

  if (n === "author" && notionType === "rich_text") return { source: "static", sourceKey: "Author" };

  return null;
}

/** @internal */
export function autoGeneratePropertyMap(
  schema: Record<string, { type: string }>
): PropertyMapping[] {
  const map: PropertyMapping[] = [];

  for (const [name, spec] of Object.entries(schema)) {
    const notionType = schemaTypeToMappingType(spec.type);
    if (!notionType) continue;

    const inferred = inferMappingFromProperty(name, notionType);
    if (!inferred) continue;

    map.push({
      notionProperty: name,
      notionType,
      ...inferred,
    });
  }

  if (!map.some((item) => item.source === "title")) {
    const firstTitle = Object.entries(schema).find(([, spec]) => spec.type === "title");
    if (firstTitle) {
      map.unshift({
        notionProperty: firstTitle[0],
        notionType: "title",
        source: "title",
      });
    }
  }

  return map;
}

async function runSetup(vaultFlag?: string): Promise<void> {
  console.log();
  log(bold("Second Brain — Publish Setup"));
  console.log();
  log("1. Create a Notion integration:");
  log(`   ${dim("https://www.notion.so/my-integrations")}`);
  log("2. Copy the Internal Integration Token");
  log("3. Share your target Notion database with that integration");
  console.log();

  if (!process.env.NOTION_API_TOKEN) {
    error("NOTION_API_TOKEN is not set in your shell environment.");
    log(`Export it first, then rerun ${dim("second-brain publish setup")}.`);
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const rawInput = await rl.question("Notion database ID or URL: ");
  rl.close();

  const databaseId = extractDatabaseId(rawInput);
  if (!databaseId) {
    error("Could not parse a database ID from that input.");
    process.exit(1);
  }

  const tempConfig: NotionConfig = {
    databaseId,
    auth: process.env.NOTION_API_TOKEN,
    propertyMap: [],
    bodyMap: DEFAULT_NOTION_BODY_MAP,
  };

  const client = createNotionClient(tempConfig);
  const schema = await readDatabaseSchema(client, databaseId);

  console.log();
  log(bold("Database properties:"));
  for (const [name, spec] of Object.entries(schema)) {
    log(`  - ${name}: ${cyan(spec.type)}`);
  }

  const propertyMap = autoGeneratePropertyMap(schema);

  if (!propertyMap.some((item) => item.source === "filename")) {
    warn("No filename mapping inferred. Add one manually in config for idempotent sync.");
  }

  if (!propertyMap.some((item) => item.source === "hash")) {
    warn("No hash mapping inferred. Add one manually to enable unchanged-file skipping.");
  }

  console.log();
  log(bold("Generated property map:"));
  for (const item of propertyMap) {
    const src = item.sourceKey ? `${item.source}:${item.sourceKey}` : item.source;
    log(`  - ${item.notionProperty} (${item.notionType}) <- ${src}`);
  }

  const current = resolveConfig(vaultFlag);
  const defaults: Record<string, string> = {};

  if (propertyMap.some((item) => item.source === "static" && item.sourceKey === "Author")) {
    defaults.Author = "";
  }

  const next: Partial<Config> = {
    vaultPath: current.vaultPath,
    integrations: {
      notion: {
        databaseId,
        auth: "$NOTION_API_TOKEN",
        defaults: Object.keys(defaults).length > 0 ? defaults : undefined,
        propertyMap,
        bodyMap: DEFAULT_NOTION_BODY_MAP,
      },
    },
  };

  saveConfig(next);

  console.log();
  success("Notion publish config saved to ~/.config/second-brain/config.json");
  log("Next steps:");
  log(`  1. Add ${bold("NOTION_API_TOKEN")} to ~/.secrets/.env (or your shell profile)`);
  log(`  2. Run ${dim("second-brain publish --dry-run")}`);
  console.log();
}

function moveToPublished(vaultPath: string, filePath: string): void {
  const pipelineDir = join(vaultPath, "03_creating", "pipeline");
  const publishedDir = join(vaultPath, "04_published");

  const rel = relative(pipelineDir, filePath);
  if (rel.startsWith("..")) return;

  const destination = join(publishedDir, rel);
  mkdirSync(dirname(destination), { recursive: true });

  if (existsSync(destination)) {
    const latest = readFileSync(filePath, "utf-8");
    writeFileSync(destination, latest);
    unlinkSync(filePath);
    return;
  }

  renameSync(filePath, destination);
}

/** @internal */
export function shouldIncludePost(
  statusFilter: string,
  postStatus: string,
  options: PublishOptions,
  targetFileMode: boolean
): boolean {
  if (targetFileMode) {
    if (!options.status) return true;
    return postStatus === normalizeStatus(options.status);
  }

  if (options.all) return true;
  return postStatus === statusFilter;
}

export async function publish(
  target: string | undefined,
  options: PublishOptions,
  vaultFlag?: string
): Promise<void> {
  if (target === "setup") {
    await runSetup(vaultFlag);
    return;
  }

  const config = resolveConfig(vaultFlag);
  const vaultPath = config.vaultPath;
  const notionConfig = config.integrations?.notion;

  if (!notionConfig) {
    error("Notion integration is not configured.");
    log(`Run ${dim("second-brain publish setup")} first.`);
    process.exit(1);
  }

  const pipelineDir = join(vaultPath, "03_creating", "pipeline");

  const targetFileMode = Boolean(target);
  const files = target
    ? (() => {
        const resolved = resolveTargetFile(vaultPath, target);
        if (!resolved) {
          error(`File not found: ${target}`);
          process.exit(1);
        }
        return [resolved];
      })()
    : listMarkdownFiles(pipelineDir);

  if (files.length === 0) {
    warn("No markdown files found to publish.");
    return;
  }

  const statusFilter = normalizeStatus(options.status || "ready");

  console.log();
  log(bold("Second Brain — Publish"));
  log(`Vault: ${dim(vaultPath)}`);
  log(`Database: ${dim(notionConfig.databaseId)}`);
  log(
    `Mode: ${
      options.dryRun ? cyan("dry-run") : cyan("live")
    }${options.force ? `, ${cyan("force")}` : ""}`
  );
  console.log();

  const client = createNotionClient(notionConfig);
  const filenameProperty = findFilenameProperty(notionConfig);
  const hashProperty = findHashProperty(notionConfig);

  const summary: PublishSummary = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    moved: 0,
  };

  for (const filePath of files) {
    const filename = basename(filePath);

    try {
      const content = readFileSync(filePath, "utf-8");
      const parsed = parsePipelinePost(content);
      const postStatus = normalizeStatus(parsed.metadata["Status"]);

      if (!shouldIncludePost(statusFilter, postStatus, options, targetFileMode)) {
        log(`${dim(filename)} -> skip (status: ${postStatus || "none"})`);
        summary.skipped++;
        continue;
      }

      const hash = sha256(content);
      const properties = buildProperties(parsed, filename, hash, notionConfig);
      const blocks = buildBlocks(parsed, notionConfig);

      const page = await findPageByFilename(
        client,
        notionConfig.databaseId,
        filename,
        filenameProperty
      );

      if (!page) {
        if (options.dryRun) {
          log(`${dim(filename)} -> create`);
        } else {
          await createPage(client, notionConfig.databaseId, properties, blocks);
          success(`${filename} -> created`);
        }

        summary.created++;

        if (!options.dryRun) {
          moveToPublished(vaultPath, filePath);
          summary.moved++;
        }

        continue;
      }

      const remoteHash =
        hashProperty
          ? getPropertyValueFromPage(page, hashProperty)
          : await getPageSyncHash(client, page.id);

      if (!options.force && remoteHash && remoteHash === hash) {
        log(`${dim(filename)} -> skip (hash unchanged)`);
        summary.skipped++;
        continue;
      }

      if (options.dryRun) {
        log(`${dim(filename)} -> update`);
      } else {
        await updatePage(client, page.id, properties, blocks);
        success(`${filename} -> updated`);
      }

      summary.updated++;

      if (!options.dryRun) {
        moveToPublished(vaultPath, filePath);
        summary.moved++;
      }
    } catch (err) {
      summary.failed++;
      const message = err instanceof Error ? err.message : String(err);
      error(`${filename} -> failed: ${message}`);
    }
  }

  console.log();
  log(bold("Publish summary"));
  log(`  Created: ${summary.created}`);
  log(`  Updated: ${summary.updated}`);
  log(`  Skipped: ${summary.skipped}`);
  log(`  Failed:  ${summary.failed}`);
  if (!options.dryRun) {
    log(`  Moved:   ${summary.moved}`);
  }
  console.log();

  if (summary.failed > 0) {
    process.exit(1);
  }
}
