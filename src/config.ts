import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".config", "second-brain");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const DEFAULT_VAULT = join(homedir(), "Documents", "Second_Brain");

interface Config {
  vaultPath: string;
}

/**
 * Resolve the vault path. Priority:
 * 1. --vault flag (passed as argument)
 * 2. $SECOND_BRAIN_PATH env
 * 3. ~/.config/second-brain/config.json → vaultPath
 * 4. ~/Documents/Second_Brain
 */
export function resolveVaultPath(flagValue?: string): string {
  if (flagValue) return resolvePath(flagValue);

  const envPath = process.env.SECOND_BRAIN_PATH;
  if (envPath) return resolvePath(envPath);

  if (existsSync(CONFIG_FILE)) {
    try {
      const raw = JSON.parse(
        require("fs").readFileSync(CONFIG_FILE, "utf-8")
      ) as Config;
      if (raw.vaultPath) return resolvePath(raw.vaultPath);
    } catch {
      // ignore malformed config
    }
  }

  return DEFAULT_VAULT;
}

export function saveConfig(vaultPath: string): void {
  const { mkdirSync, writeFileSync } = require("fs") as typeof import("fs");
  mkdirSync(CONFIG_DIR, { recursive: true });
  const config: Config = { vaultPath };
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
}

export function getPackageRoot(): string {
  // The package ships vault/ inside it. Walk up from this file to find it.
  // src/config.ts → project root
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
