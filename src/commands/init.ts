import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import {
  log,
  success,
  warn,
  error,
  bold,
  dim,
  requireBun,
  checkCommand,
  exec,
} from "../utils.ts";
import { resolveVaultPath, saveConfig, getPackageRoot, VAULT_DIRS } from "../config.ts";
import { copyTemplates } from "../templates.ts";

export function init(vaultFlag?: string): void {
  const vaultPath = resolveVaultPath(vaultFlag);
  const packageRoot = getPackageRoot();
  const templateSrc = join(packageRoot, "vault");

  console.log();
  log(bold("Second Brain — Init"));
  log(`Vault path: ${dim(vaultPath)}`);
  console.log();

  // ── Prerequisites ──────────────────────────────────────────────────────
  requireBun();

  // ── Create vault directories ───────────────────────────────────────────
  log("Creating vault directories...");
  for (const dir of VAULT_DIRS) {
    mkdirSync(join(vaultPath, dir), { recursive: true });
  }
  success("Directory structure ready");

  // ── Copy templates (no-clobber) ────────────────────────────────────────
  log("Copying templates...");
  const copied = copyTemplates(templateSrc, vaultPath);
  if (copied > 0) {
    success(`${copied} template file${copied === 1 ? "" : "s"} copied`);
  } else {
    success("All templates already present");
  }

  // ── Install QMD if missing ─────────────────────────────────────────────
  if (!checkCommand("qmd", "")) {
    log("Installing QMD...");
    const result = exec(["bun", "install", "-g", "@tobilu/qmd"]);
    if (result.ok) {
      success("QMD installed");
    } else {
      warn("QMD install failed — run manually: bun install -g @tobilu/qmd");
    }
  } else {
    success("QMD already installed");
  }

  // ── Configure QMD ──────────────────────────────────────────────────────
  const qmdConfigDir = join(
    process.env.HOME || process.env.USERPROFILE || "~",
    ".config",
    "qmd"
  );
  const qmdConfigFile = join(qmdConfigDir, "index.yml");

  if (!existsSync(qmdConfigFile)) {
    mkdirSync(qmdConfigDir, { recursive: true });
    const config = `collections:\n  second-brain:\n    path: ${vaultPath}\n    pattern: "**/*.md"\n`;
    require("fs").writeFileSync(qmdConfigFile, config);
    success("QMD config created");
  } else {
    success("QMD config already exists");
  }

  // ── Index the vault ────────────────────────────────────────────────────
  log("Indexing vault...");
  // Check if collection already exists
  const listResult = exec(["qmd", "collection", "list"]);
  const hasCollection = listResult.ok && listResult.stdout.includes("second-brain");
  if (hasCollection) {
    exec(["qmd", "update"]);
  } else {
    const add = exec(["qmd", "collection", "add", vaultPath, "--name", "second-brain"]);
    if (!add.ok) {
      warn("Failed to create QMD collection. Run manually: qmd collection add " + vaultPath + " --name second-brain");
    }
  }
  success("Vault indexed");

  log("Generating embeddings (downloads ~2GB of models on first run)...");
  const embed = exec(["qmd", "embed"]);
  if (!embed.ok) {
    warn("Embedding failed — run 'qmd embed' manually later");
  }

  // ── Save config ────────────────────────────────────────────────────────
  saveConfig({ vaultPath });
  success("Config saved");

  // ── Done ───────────────────────────────────────────────────────────────
  console.log();
  success(bold("Setup complete!"));
  console.log();
  log("Next steps:");
  log(`  1. Open Obsidian → "Open folder as vault" → ${vaultPath}`);
  log("  2. Edit AGENTS.md and voice-profile.md with your info");
  log("  3. Start adding notes to 00_inbox/");
  log(`  4. ${dim("second-brain status")} — check vault health`);
  log(`  5. ${dim("second-brain draft \"topic\"")} — generate content`);
  console.log();
}
