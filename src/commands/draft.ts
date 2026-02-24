import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "bun";
import {
  log,
  success,
  warn,
  error,
  bold,
  dim,
  cyan,
  requireQmd,
  exec,
  execLive,
  slugify,
} from "../utils.ts";
import {
  resolveVaultPath,
  resolveApiKey,
  resolveModel,
} from "../config.ts";
import { streamGatewayResponse } from "../gateway.ts";

type Agent = "claude" | "cursor" | "codex" | "gateway";

function commandExists(name: string): boolean {
  const result = spawnSync(["which", name], { stdout: "ignore", stderr: "ignore" });
  return result.exitCode === 0;
}

function detectAgent(): Agent | null {
  if (commandExists("claude")) return "claude";
  if (commandExists("cursor")) return "cursor";
  if (commandExists("codex")) return "codex";
  if (resolveApiKey()) return "gateway";
  return null;
}

function readIfExists(path: string): string {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

export async function draft(
  topic: string | undefined,
  agentFlag?: string,
  vaultFlag?: string,
  modelFlag?: string
): Promise<void> {
  if (!topic) {
    error("Missing topic.");
    log(`Usage: ${dim('second-brain draft "your topic"')}`);
    log(`       ${dim('second-brain draft "leadership" --agent gateway --model deepinfra/deepseek-v3.2')}`);
    process.exit(1);
  }

  const vaultPath = resolveVaultPath(vaultFlag);

  console.log();
  log(bold("Second Brain — Draft"));
  log(`Topic: ${cyan(topic)}`);
  log(`Vault: ${dim(vaultPath)}`);
  console.log();

  // ── 1. Search vault via QMD ────────────────────────────────────────────
  requireQmd();
  log("Searching vault...");
  const searchResult = exec([
    "qmd",
    "query",
    topic,
    "-c",
    "second-brain",
    "-n",
    "10",
    "--full",
  ]);

  let searchContext = "";
  if (searchResult.ok && searchResult.stdout) {
    searchContext = searchResult.stdout;
    success("Found relevant notes");
  } else {
    warn("No search results — drafting without vault context");
  }

  // ── 2. Load content engine files ───────────────────────────────────────
  const engineDir = join(vaultPath, "06_system", "content-engine");
  const voiceProfile = readIfExists(join(engineDir, "voice-profile.md"));
  const structures = readIfExists(join(engineDir, "structures.md"));
  const learnings = readIfExists(join(engineDir, "learnings.md"));

  const hasEngine = voiceProfile || structures || learnings;
  if (hasEngine) {
    success("Loaded content engine files");
  } else {
    warn("No content engine files found — using defaults");
  }

  // ── 3. Assemble prompt ─────────────────────────────────────────────────
  const sections: string[] = [];

  sections.push(`# Content Draft Request\n\nTopic: "${topic}"\n`);

  if (voiceProfile) {
    sections.push(`## Voice Profile\n\n${voiceProfile}\n`);
  }

  if (structures) {
    sections.push(`## Available Structures\n\n${structures}\n`);
  }

  if (learnings) {
    sections.push(`## Learnings & Insights\n\n${learnings}\n`);
  }

  if (searchContext) {
    sections.push(`## Relevant Notes from Vault\n\n${searchContext}\n`);
  }

  sections.push(`## Instructions

You are drafting content about "${topic}" for the Second Brain content engine.

Using the voice profile, structures, learnings, and vault notes above:

1. **Identify the strongest angle** from the vault notes — what unique insight or connection stands out?
2. **Pick 2-3 structures** from the structures doc that best fit this topic and angle.
3. **Draft content** for each structure:
   - One version for X (Twitter) — short, punchy, max 280 chars for single tweet
   - One version for LinkedIn — narrative, personal, 5-15 lines
4. **Cite sources** — reference which vault notes informed each draft using [[wiki links]]
5. **Check learnings** — avoid patterns that underperformed, lean into what works

Save the drafts as pipeline files in 03_creating/pipeline/ using the pipeline-post template format.

Important: Write in the voice described in the voice profile. If no voice profile exists, write in a direct, thoughtful, builder-mindset tone.
`);

  const prompt = sections.join("\n---\n\n");

  // ── 4. Detect agent ────────────────────────────────────────────────────
  let agent: Agent | null = null;

  if (agentFlag) {
    if (!["claude", "cursor", "codex", "gateway"].includes(agentFlag)) {
      error(`Unknown agent: ${agentFlag}. Use: claude, cursor, codex, or gateway`);
      process.exit(1);
    }
    agent = agentFlag as Agent;
  } else {
    agent = detectAgent();
  }

  if (!agent) {
    // Fallback: write prompt to file
    const promptPath = join(vaultPath, ".draft-prompt.md");
    writeFileSync(promptPath, prompt);
    console.log();
    warn("No supported agent found (claude, cursor, codex, gateway).");
    success(`Prompt saved to: ${bold(promptPath)}`);
    log("Install an agent CLI or configure gateway with:");
    log(`  ${dim('second-brain config set apiKey "<key>"')}`);
    console.log();
    return;
  }

  if (agent !== "gateway" && !commandExists(agent)) {
    error(`${agent} is not installed or not in PATH.`);
    process.exit(1);
  }

  if (agent === "gateway" && !resolveApiKey()) {
    error("Gateway selected but no API key found.");
    log(`Set one with ${dim('second-brain config set apiKey "<key>"')} or AI_GATEWAY_API_KEY.`);
    process.exit(1);
  }

  log(`Using agent: ${bold(agent)}`);

  // ── 5. Launch agent ────────────────────────────────────────────────────
  console.log();

  switch (agent) {
    case "claude": {
      // Write prompt to file for context, then launch Claude in print mode
      const promptPath = join(vaultPath, ".draft-prompt.md");
      writeFileSync(promptPath, prompt);
      success(`Prompt saved to ${dim(promptPath)}`);
      log("Launching Claude Code...");
      console.log();
      const exitCode = execLive(["claude", "-p", prompt]);
      process.exit(exitCode);
      break;
    }

    case "cursor": {
      const promptPath = join(vaultPath, ".draft-prompt.md");
      writeFileSync(promptPath, prompt);
      success(`Prompt saved to ${bold(promptPath)}`);
      log("Opening Cursor on vault...");
      exec(["cursor", vaultPath]);
      console.log();
      log("Prompt file is ready. Open .draft-prompt.md in Cursor and use it.");
      console.log();
      break;
    }

    case "codex": {
      log("Launching Codex...");
      console.log();
      const exitCode = execLive(["codex", prompt]);
      process.exit(exitCode);
      break;
    }

    case "gateway": {
      const apiKey = resolveApiKey();
      if (!apiKey) {
        error("No API key configured for gateway.");
        log(`Set one with ${dim('second-brain config set apiKey "<key>"')} or AI_GATEWAY_API_KEY.`);
        process.exit(1);
      }

      const model = resolveModel(modelFlag);
      const pipelineDir = join(vaultPath, "03_creating", "pipeline");
      const filePath = join(pipelineDir, `${slugify(topic)}.md`);
      if (existsSync(filePath)) {
        error(`File already exists: ${filePath}`);
        process.exit(1);
      }

      log(`Model: ${dim(model)}`);
      log("Generating draft via Vercel AI Gateway...");
      console.log();

      const output = await streamGatewayResponse(prompt, model, apiKey);

      console.log();
      mkdirSync(pipelineDir, { recursive: true });
      writeFileSync(filePath, output.endsWith("\n") ? output : `${output}\n`);

      success(`Draft saved to: ${bold(filePath)}`);
      console.log();
      break;
    }
  }
}
