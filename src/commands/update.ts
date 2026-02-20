import { mkdirSync } from "fs";
import { join } from "path";
import {
  log,
  success,
  warn,
  error,
  bold,
  dim,
  exec,
  requireQmd,
} from "../utils.ts";
import { resolveVaultPath, getPackageRoot, VAULT_DIRS } from "../config.ts";
import { copyTemplates } from "../templates.ts";

export function update(vaultFlag?: string): void {
  const vaultPath = resolveVaultPath(vaultFlag);
  const packageRoot = getPackageRoot();
  const templateSrc = join(packageRoot, "vault");

  console.log();
  log(bold("Second Brain — Update"));
  log(`Vault path: ${dim(vaultPath)}`);
  console.log();

  // ── Ensure directories ─────────────────────────────────────────────────
  for (const dir of VAULT_DIRS) {
    mkdirSync(join(vaultPath, dir), { recursive: true });
  }
  success("Directory structure verified");

  // ── Copy new templates (no-clobber) ────────────────────────────────────
  log("Checking for new templates...");
  const copied = copyTemplates(templateSrc, vaultPath);
  if (copied > 0) {
    success(`${copied} new template file${copied === 1 ? "" : "s"} added`);
  } else {
    success("All templates up to date");
  }

  // ── Update QMD ─────────────────────────────────────────────────────────
  log("Checking for QMD updates...");
  const qmdUpdate = exec(["bun", "install", "-g", "@tobilu/qmd"]);
  if (qmdUpdate.ok) {
    success("QMD up to date");
  } else {
    warn("QMD update failed — run: bun install -g @tobilu/qmd");
  }

  // ── Re-index ───────────────────────────────────────────────────────────
  requireQmd();
  log("Re-indexing vault...");
  exec(["qmd", "update"]);
  const embed = exec(["qmd", "embed"]);
  if (embed.ok) {
    success("Vault re-indexed");
  } else {
    warn("Embedding failed — run 'qmd embed' manually");
  }

  console.log();
  success(bold("Update complete!"));
  console.log();
}
