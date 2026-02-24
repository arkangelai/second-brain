import { basename, isAbsolute, join } from "path";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { resolveConfig } from "../config.ts";
import { parsePipelinePost, updatePostMetadata } from "../parser.ts";
import {
  createNotionClient,
  findPageByFilename,
  readPageProperties,
} from "../notion.ts";
import { bold, dim, error, log, success, warn } from "../utils.ts";

export interface PullOptions {
  dryRun?: boolean;
}

function listMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { recursive: true })
    .map((entry) => String(entry))
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => join(dir, entry))
    .sort();
}

function resolvePublishedFile(vaultPath: string, fileArg: string): string | null {
  const publishedDir = join(vaultPath, "04_published");

  if (isAbsolute(fileArg) && existsSync(fileArg)) {
    return fileArg;
  }

  const candidates = [
    join(publishedDir, fileArg),
    join(vaultPath, fileArg),
  ];

  for (const file of candidates) {
    if (existsSync(file)) return file;
  }

  return null;
}

function buildMetricsSection(entries: Record<string, string>): string {
  const lines = ["## Metrics", ""];

  for (const [key, value] of Object.entries(entries)) {
    lines.push(`- ${key}: ${value}`);
  }

  return lines.join("\n");
}

function upsertMetricsSection(content: string, entries: Record<string, string>): string {
  if (Object.keys(entries).length === 0) {
    return content;
  }

  const section = buildMetricsSection(entries);

  const regex = /\n## Metrics\n[\s\S]*?(?=\n##\s+|$)/m;
  if (regex.test(content)) {
    return content.replace(regex, `\n${section}`) + (content.endsWith("\n") ? "" : "\n");
  }

  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  return `${normalized}\n${section}\n`;
}

function getFilenameProperty(propertyMap: Array<{ source: string; notionProperty: string }>): string {
  return propertyMap.find((item) => item.source === "filename")?.notionProperty || "Filename";
}

export async function pull(
  target: string | undefined,
  options: PullOptions,
  vaultFlag?: string
): Promise<void> {
  const config = resolveConfig(vaultFlag);
  const vaultPath = config.vaultPath;
  const notionConfig = config.integrations?.notion;

  if (!notionConfig) {
    error("Notion integration is not configured.");
    log(`Run ${dim("second-brain publish setup")} first.`);
    process.exit(1);
  }

  const publishedDir = join(vaultPath, "04_published");
  const files = target
    ? (() => {
        const resolved = resolvePublishedFile(vaultPath, target);
        if (!resolved) {
          error(`File not found: ${target}`);
          process.exit(1);
        }
        return [resolved];
      })()
    : listMarkdownFiles(publishedDir);

  if (files.length === 0) {
    warn("No published markdown files found.");
    return;
  }

  const client = createNotionClient(notionConfig);
  const filenameProperty = getFilenameProperty(notionConfig.propertyMap);
  const readableMappings = notionConfig.propertyMap.filter(
    (mapping) => mapping.source === "metadata" || mapping.source === "pull-only"
  );

  console.log();
  log(bold("Second Brain — Pull"));
  log(`Vault: ${dim(vaultPath)}`);
  log(`Mode: ${options.dryRun ? dim("dry-run") : dim("live")}`);
  console.log();

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of files) {
    const filename = basename(filePath);

    try {
      const content = readFileSync(filePath, "utf-8");
      parsePipelinePost(content);

      const page = await findPageByFilename(
        client,
        notionConfig.databaseId,
        filename,
        filenameProperty
      );

      if (!page) {
        log(`${dim(filename)} -> skip (not found in Notion)`);
        skipped++;
        continue;
      }

      const propertyNames = [...new Set(readableMappings.map((item) => item.notionProperty))];
      const values = await readPageProperties(client, page.id, propertyNames);

      const metadataUpdates: Record<string, string> = {};
      const metrics: Record<string, string> = {};

      for (const mapping of readableMappings) {
        const key = mapping.sourceKey || mapping.notionProperty;
        const value = (values[mapping.notionProperty] || "").trim();
        if (!value) continue;

        if (mapping.source === "metadata") {
          metadataUpdates[key] = value;
          continue;
        }

        metrics[key] = value;
      }

      let next = updatePostMetadata(content, metadataUpdates);
      next = upsertMetricsSection(next, metrics);

      if (next === content) {
        log(`${dim(filename)} -> skip (no changes)`);
        skipped++;
        continue;
      }

      if (options.dryRun) {
        log(`${dim(filename)} -> update`);
      } else {
        writeFileSync(filePath, next);
        success(`${filename} -> updated`);
      }

      updated++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      error(`${filename} -> failed: ${message}`);
    }
  }

  console.log();
  log(bold("Pull summary"));
  log(`  Updated: ${updated}`);
  log(`  Skipped: ${skipped}`);
  log(`  Failed:  ${failed}`);
  console.log();

  if (failed > 0) {
    process.exit(1);
  }
}
