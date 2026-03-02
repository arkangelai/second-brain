import { spawnSync } from "bun";

// ─── Colors ──────────────────────────────────────────────────────────────────

const isColorSupported =
  process.env.FORCE_COLOR !== "0" &&
  process.env.NO_COLOR === undefined &&
  process.stdout.isTTY;

const fmt = (open: string, close: string) => (s: string) =>
  isColorSupported ? `\x1b[${open}m${s}\x1b[${close}m` : s;

export const bold = fmt("1", "22");
export const dim = fmt("2", "22");
export const green = fmt("32", "39");
export const red = fmt("31", "39");
export const yellow = fmt("33", "39");
export const cyan = fmt("36", "39");

// ─── Logging ─────────────────────────────────────────────────────────────────

export function log(msg: string) {
  console.log(`  ${msg}`);
}

export function success(msg: string) {
  console.log(`  ${green("✓")} ${msg}`);
}

export function warn(msg: string) {
  console.log(`  ${yellow("⚠")} ${msg}`);
}

export function error(msg: string) {
  console.error(`  ${red("✗")} ${msg}`);
}

// ─── Exec ────────────────────────────────────────────────────────────────────

export interface ExecResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function exec(cmd: string[]): ExecResult {
  const result = spawnSync(cmd, {
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    ok: result.exitCode === 0,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
    exitCode: result.exitCode,
  };
}

export function execLive(cmd: string[]): number {
  const result = spawnSync(cmd, {
    stdout: "inherit",
    stderr: "inherit",
  });
  return result.exitCode;
}

// ─── Prerequisite checks ────────────────────────────────────────────────────

export function checkCommand(name: string, installHint: string): boolean {
  const result = spawnSync(["which", name], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    error(`${name} not found.`);
    log(`  ${dim(installHint)}`);
    return false;
  }
  return true;
}

export function requireCommand(name: string, installHint: string): void {
  if (!checkCommand(name, installHint)) {
    process.exit(1);
  }
}

export function requireBun(): void {
  requireCommand("bun", "Install Bun: curl -fsSL https://bun.sh/install | bash");
}

export function requireQmd(): void {
  requireCommand("qmd", "Install QMD: bun install -g @tobilu/qmd");
}

// ─── Plugin install ─────────────────────────────────────────────────────────

import { mkdirSync, readFileSync } from "fs";
import { join } from "path";
import {
  CLAUDE_SIDEBAR_VERSION,
  CLAUDE_SIDEBAR_BASE_URL,
  CLAUDE_SIDEBAR_FILES,
} from "./config.ts";

export function installClaudeSidebar(vaultPath: string): boolean {
  const pluginDir = join(vaultPath, ".obsidian", "plugins", "claude-sidebar");
  mkdirSync(pluginDir, { recursive: true });

  let ok = true;
  for (const file of CLAUDE_SIDEBAR_FILES) {
    const dl = exec([
      "curl", "-fsSL",
      "-o", join(pluginDir, file),
      `${CLAUDE_SIDEBAR_BASE_URL}/${file}`,
    ]);
    if (!dl.ok) {
      ok = false;
      warn(`Failed to download ${file}`);
    }
  }

  // Validate manifest to catch corrupted or tampered downloads
  if (ok) {
    try {
      const manifest = JSON.parse(
        readFileSync(join(pluginDir, "manifest.json"), "utf-8")
      );
      if (manifest.id !== "claude-sidebar") {
        warn("Plugin manifest validation failed — unexpected plugin id");
        ok = false;
      }
    } catch {
      warn("Plugin manifest validation failed — could not parse manifest.json");
      ok = false;
    }
  }

  return ok;
}

// ─── Slugify ─────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
