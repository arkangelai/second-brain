import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { log, success, warn, bold, dim, cyan, exec, checkCommand } from "../utils.ts";
import { resolveVaultPath } from "../config.ts";

function countMdFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir, { recursive: true })
      .filter((f) => String(f).endsWith(".md"))
      .length;
  } catch {
    return 0;
  }
}

export function status(vaultFlag?: string): void {
  const vaultPath = resolveVaultPath(vaultFlag);

  console.log();
  log(bold("Second Brain — Status"));
  log(`Vault: ${dim(vaultPath)}`);
  console.log();

  if (!existsSync(vaultPath)) {
    warn(`Vault not found at ${vaultPath}`);
    log(`Run ${dim("second-brain init")} to set up.`);
    console.log();
    return;
  }

  // ── File counts ────────────────────────────────────────────────────────
  const counts: [string, string][] = [
    ["Inbox", "00_inbox"],
    ["Thinking notes", "01_thinking/notes"],
    ["MOCs", "01_thinking"],
    ["Reference", "02_reference"],
    ["Pipeline", "03_creating/pipeline"],
    ["Drafts", "03_creating/drafts"],
    ["Published", "04_published"],
    ["Archive", "05_archive"],
  ];

  log(bold("Files:"));
  let total = 0;
  for (const [label, subdir] of counts) {
    const dir = join(vaultPath, subdir);
    // For MOCs, only count direct .md files (not notes/ subdir)
    let count: number;
    if (subdir === "01_thinking") {
      try {
        count = existsSync(dir)
          ? readdirSync(dir)
              .filter((f) => String(f).endsWith(".md"))
              .length
          : 0;
      } catch {
        count = 0;
      }
    } else {
      count = countMdFiles(dir);
    }
    total += count;
    const countStr = String(count).padStart(4);
    log(`  ${cyan(countStr)}  ${label}`);
  }
  log(`  ${cyan(String(total).padStart(4))}  ${bold("Total")}`);

  // ── QMD status ─────────────────────────────────────────────────────────
  console.log();
  if (checkCommand("qmd", "Install QMD: bun install -g @tobilu/qmd")) {
    log(bold("QMD:"));
    const result = exec(["qmd", "status"]);
    if (result.ok) {
      for (const line of result.stdout.split("\n")) {
        log(`  ${line}`);
      }
    } else {
      warn("QMD status check failed. Run 'qmd status' manually.");
    }
  }

  console.log();
}
