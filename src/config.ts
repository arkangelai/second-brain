import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".config", "second-brain");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const DEFAULT_VAULT = join(homedir(), "Documents", "Second_Brain");
const DEFAULT_MODEL = "deepinfra/deepseek-v3.2";

export interface Config {
  vaultPath?: string;
  aiGatewayApiKey?: string;
  defaultModel?: string;
  integrations?: {
    notion?: NotionConfig;
  };
}

export interface NotionConfig {
  databaseId: string;
  auth: string;
  defaults?: Record<string, string>;
  propertyMap: PropertyMapping[];
  bodyMap?: BodyMapping;
}

export interface PropertyMapping {
  notionProperty: string;
  notionType: "title" | "select" | "rich_text" | "date" | "url" | "number";
  source: "metadata" | "filename" | "title" | "hash" | "static" | "pull-only";
  sourceKey?: string;
}

export interface BodyMapping {
  sections: Array<{
    markdownHeading: string;
    notionHeading: string;
    headingLevel: 2 | 3;
  }>;
}

export interface ResolvedConfig extends Omit<Config, "vaultPath"> {
  vaultPath: string;
}

export const DEFAULT_NOTION_BODY_MAP: BodyMapping = {
  sections: [
    { markdownHeading: "Core Idea", notionHeading: "Idea", headingLevel: 2 },
    { markdownHeading: "Draft", notionHeading: "Draft", headingLevel: 2 },
    { markdownHeading: "Notes", notionHeading: "Notes", headingLevel: 2 },
  ],
};

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStoredConfig(): Config {
  if (!existsSync(CONFIG_FILE)) return {};

  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as
      | Record<string, unknown>
      | null;

    if (!raw || typeof raw !== "object") return {};

    const config: Config = {};

    const vaultPath = cleanString(raw.vaultPath);
    const aiGatewayApiKey = cleanString(raw.aiGatewayApiKey);
    const defaultModel = cleanString(raw.defaultModel);

    if (vaultPath) config.vaultPath = vaultPath;
    if (aiGatewayApiKey) config.aiGatewayApiKey = aiGatewayApiKey;
    if (defaultModel) config.defaultModel = defaultModel;

    if (isPlainObject(raw.integrations)) {
      config.integrations = raw.integrations as Config["integrations"];
    }

    return config;
  } catch {
    // ignore malformed config
    return {};
  }
}

export function loadConfig(): Config {
  return readStoredConfig();
}

/**
 * Resolve env references like "$NOTION_API_TOKEN".
 */
export function resolveEnvValue(value?: string): string {
  if (!value) return "";
  if (!value.startsWith("$")) return value;
  const envName = value.slice(1).trim();
  if (!envName) return "";
  return process.env[envName] || "";
}

/**
 * Resolve full config. Priority for vault path:
 * 1. --vault flag (passed as argument)
 * 2. $SECOND_BRAIN_PATH env
 * 3. ~/.config/second-brain/config.json -> vaultPath
 * 4. ~/Documents/Second_Brain
 */
export function resolveConfig(flagValue?: string): ResolvedConfig {
  const stored = readStoredConfig();

  const envPath = process.env.SECOND_BRAIN_PATH;
  const vaultPath = resolvePath(flagValue || envPath || stored.vaultPath || DEFAULT_VAULT);

  const notion = stored.integrations?.notion
    ? {
        ...stored.integrations.notion,
        auth: resolveEnvValue(stored.integrations.notion.auth),
        bodyMap: stored.integrations.notion.bodyMap || DEFAULT_NOTION_BODY_MAP,
      }
    : undefined;

  return {
    ...stored,
    vaultPath,
    integrations: notion ? { notion } : stored.integrations,
  };
}

/**
 * Resolve the vault path only (backward-compatible helper).
 */
export function resolveVaultPath(flagValue?: string): string {
  return resolveConfig(flagValue).vaultPath;
}

function deepMerge<T extends object>(
  base: Partial<T>,
  patch: Partial<T>
): Partial<T> {
  const out: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    const prev = out[key];

    if (isPlainObject(prev) && isPlainObject(value)) {
      out[key] = deepMerge(prev as object, value as object);
      continue;
    }

    if (value !== undefined) {
      out[key] = value;
    }
  }

  return out as Partial<T>;
}

export function saveConfig(configOrVaultPath: Partial<Config> | string): void {
  const stored = readStoredConfig();
  const patch: Partial<Config> =
    typeof configOrVaultPath === "string"
      ? { vaultPath: configOrVaultPath }
      : configOrVaultPath;

  const merged = deepMerge<Config>(stored, patch) as Config;

  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2) + "\n");
}

export function resolveApiKey(): string | undefined {
  const envKey = cleanString(process.env.AI_GATEWAY_API_KEY);
  if (envKey) return envKey;

  return loadConfig().aiGatewayApiKey;
}

export function resolveModel(flagValue?: string): string {
  const flagModel = cleanString(flagValue);
  if (flagModel) return flagModel;

  const configModel = loadConfig().defaultModel;
  if (configModel) return configModel;

  return DEFAULT_MODEL;
}

export function getPackageRoot(): string {
  // The package ships vault/ inside it. Walk up from this file to find it.
  // src/config.ts -> project root
  return join(import.meta.dir, "..");
}

function resolvePath(p: string): string {
  if (p.startsWith("~")) {
    return join(homedir(), p.slice(1));
  }
  return p;
}

// ─── Vault directories ─────────────────────────────────────────────────────

export const VAULT_DIRS = [
  "00_inbox",
  "01_thinking/notes",
  "02_reference/approaches",
  "02_reference/tools",
  "02_reference/sources/books",
  "02_reference/sources/podcasts",
  "02_reference/sources/articles",
  "03_creating/drafts",
  "03_creating/pipeline",
  "04_published",
  "05_archive",
  "06_system/content-engine",
  "06_system/templates",
  "06_system/scripts",
  "attachments",
];
