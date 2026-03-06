import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "bun";
import { createInterface } from "readline/promises";
import { resolveConfig, resolveApiKey, resolveModel, saveConfig } from "../config.ts";
import { createNotionClient, readPropertyValue } from "../notion.ts";
import { streamGatewayResponse } from "../gateway.ts";
import { bold, dim, error, log, success, warn, checkCommand } from "../utils.ts";

export interface IdeasOptions {
  week?: boolean;
  generate?: boolean;
  model?: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function buildDateFilter(
  dateArg: string | undefined,
  week: boolean
): Record<string, unknown> {
  if (week) {
    const { start, end } = weekRange();
    return {
      and: [
        { property: "Fecha", date: { on_or_after: start } },
        { property: "Fecha", date: { on_or_before: end } },
      ],
    };
  }

  const target = dateArg || todayISO();
  return { property: "Fecha", date: { equals: target } };
}

export async function ideas(
  dateArg: string | undefined,
  options: IdeasOptions,
  vaultFlag?: string
): Promise<void> {
  const config = resolveConfig(vaultFlag);
  const notionConfig = config.integrations?.notion;

  if (!notionConfig) {
    error("Notion integration is not configured.");
    log(`Run ${dim("second-brain publish setup")} first.`);
    process.exit(1);
  }

  const client = createNotionClient(notionConfig);

  let dbId = (notionConfig as any).ideasDatabaseId;
  if (!dbId) {
    log("Ideas database not configured. Searching Notion...");
    dbId = await detectIdeasDatabase(client);
    if (!dbId) {
      error("Could not find an ideas database in your Notion workspace.");
      log("Make sure your integration has access to a database with these properties:");
      log(`  ${dim("Fecha (date), Tipo (select), Resumen (rich_text), Angulos de Contenido (rich_text)")}`);
      process.exit(1);
    }
    // Save so we don't search again next time
    saveConfig({
      integrations: {
        ...config.integrations,
        notion: { ...notionConfig, ideasDatabaseId: dbId },
      },
    });
    success(`Ideas database detected and saved: ${dim(dbId)}`);
    console.log();
  }
  const filter = buildDateFilter(dateArg, Boolean(options.week));

  console.log();
  log(bold("Second Brain — Ideas"));
  if (options.week) {
    const { start, end } = weekRange();
    log(`Period: ${dim(`${start} → ${end}`)}`);
  } else {
    log(`Date: ${dim(dateArg || todayISO())}`);
  }
  console.log();

  try {
    const response: any = await client.databases.query({
      database_id: dbId,
      filter: filter as any,
      sorts: [{ property: "Fecha", direction: "ascending" }],
    });

    if (response.results.length === 0) {
      warn("No ideas found for this date.");
      return;
    }

    // Fetch page bodies in parallel
    const pagesWithBody = await Promise.all(
      response.results.map(async (page: any) => ({
        page,
        body: await readPageBody(client, page.id),
      }))
    );

    for (const { page, body } of pagesWithBody) {
      const props = page.properties;
      const titulo = readPropertyValue(props.Titulo);
      const fecha = props.Fecha?.date?.start || "";
      const status = readPropertyValue(props.Status);
      const tipo = readPropertyValue(props.Tipo);
      const plataforma = readPropertyValue(props.Plataforma);

      log(bold(titulo));
      if (fecha) log(`  Fecha:      ${dim(fecha)}`);
      if (status) log(`  Status:     ${dim(status)}`);
      if (tipo) log(`  Tipo:       ${dim(tipo)}`);
      if (plataforma) log(`  Plataforma: ${dim(plataforma)}`);

      // Display body sections
      if (body) {
        for (const line of body.split("\n")) {
          if (line.startsWith("## ")) {
            console.log();
            log(bold(line.slice(3)));
          } else if (line.startsWith("- ")) {
            log(`    ${dim(line)}`);
          } else if (line.trim()) {
            log(`    ${line}`);
          }
        }
      }
      console.log();
    }

    log(dim(`${response.results.length} idea(s) found.`));

    // ── Ask user if they want to generate posts ────────────────────────
    const shouldGenerate = options.generate || await askToGenerate();
    if (!shouldGenerate) return;

    const vaultPath = config.vaultPath;

    // Load content engine files
    const engineDir = join(vaultPath, "06_system", "content-engine");
    const voiceProfile = readIfExists(join(engineDir, "voice-profile.md"));
    const structures = readIfExists(join(engineDir, "structures.md"));
    const learnings = readIfExists(join(engineDir, "learnings.md"));

    // Build ideas context with full body
    const ideasText = pagesWithBody.map(({ page, body }) => {
      const props = page.properties;
      const titulo = readPropertyValue(props.Titulo);
      const plataforma = readPropertyValue(props.Plataforma);
      return `# ${titulo}\nPlataforma: ${plataforma}\n\n${body}`;
    }).join("\n\n---\n\n");

    const prompt = buildPostPrompt(ideasText, voiceProfile, structures, learnings);

    console.log();

    // Try gateway first, fall back to claude CLI
    const apiKey = resolveApiKey();
    if (apiKey) {
      const model = resolveModel(options.model);
      log(bold("Generating posts via gateway..."));
      log(`Model: ${dim(model)}`);
      console.log();
      await streamGatewayResponse(prompt, model, apiKey);
      console.log();
    } else if (checkCommand("claude", "Install Claude Code: https://docs.anthropic.com/en/docs/claude-code")) {
      log(bold("Generating posts via Claude CLI..."));
      console.log();
      // Pass prompt via stdin to avoid command line length limits on Windows
      const env = { ...process.env };
      delete env.CLAUDECODE;
      const result = spawnSync(["claude", "-p"], {
        stdin: new TextEncoder().encode(prompt),
        stdout: "pipe",
        stderr: "pipe",
        env,
      });
      if (result.exitCode !== 0) {
        const errMsg = result.stderr?.toString().trim();
        error(`Claude CLI exited with an error.${errMsg ? ` ${errMsg}` : ""}`);
        process.exit(result.exitCode);
      }
      const output = result.stdout.toString();
      console.log(output);
      console.log();
    } else {
      error("No generation method available.");
      log(`Either set ${dim("AI_GATEWAY_API_KEY")} or install ${dim("claude")} CLI.`);
      process.exit(1);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(`Failed to query ideas: ${message}`);
    process.exit(1);
  }
}

function extractText(richText: any[]): string {
  return (richText || []).map((t: any) => t.plain_text).join("");
}

async function readPageBody(client: any, pageId: string): Promise<string> {
  const lines: string[] = [];
  let cursor: string | undefined;

  while (true) {
    const response: any = await client.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      const type = block.type;
      if (type === "heading_1" || type === "heading_2" || type === "heading_3") {
        lines.push(`## ${extractText(block[type].rich_text)}`);
      } else if (type === "paragraph") {
        const text = extractText(block[type].rich_text);
        if (text) lines.push(text);
      } else if (type === "bulleted_list_item") {
        lines.push(`- ${extractText(block[type].rich_text)}`);
      } else if (type === "numbered_list_item") {
        lines.push(`- ${extractText(block[type].rich_text)}`);
      } else if (type === "toggle") {
        lines.push(`- ${extractText(block[type].rich_text)}`);
      }
    }

    if (!response.has_more) break;
    cursor = response.next_cursor;
  }

  return lines.join("\n");
}

async function askToGenerate(): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log();
  const answer = await rl.question("  Generate a post from these ideas? (y/N) ");
  rl.close();
  return answer.trim().toLowerCase() === "y";
}

// Properties that identify an ideas database
const IDEAS_REQUIRED_PROPERTIES: Record<string, string> = {
  Fecha: "date",
  Tipo: "select",
  Resumen: "rich_text",
  "Angulos de Contenido": "rich_text",
};

async function detectIdeasDatabase(client: any): Promise<string | null> {
  const response: any = await client.search({
    filter: { property: "object", value: "database" },
  });

  for (const db of response.results) {
    const props = db.properties || {};
    const matches = Object.entries(IDEAS_REQUIRED_PROPERTIES).every(
      ([name, type]) => props[name]?.type === type
    );
    if (matches) return db.id;
  }

  return null;
}

function readIfExists(path: string): string {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

function buildPostPrompt(
  ideasText: string,
  voiceProfile: string,
  structures: string,
  learnings: string
): string {
  const sections: string[] = [];

  sections.push(`You are a content writer for Arkangel AI. Turn the following ideas into compelling posts.

## Rules
- Direct, clear, curious tone. No filler, no hashtags, no engagement bait.
- Speak from experience — "we built this", "we saw this", not "experts say".
- Technical but accessible, like Andy Weir explaining science.
- Arkangel appears as context, never as the point. If you remove the Arkangel mention and the post is still useful, it's well written.
- Language: English.`);

  if (voiceProfile) {
    sections.push(`## Voice Profile\n\n${voiceProfile}`);
  }

  if (structures) {
    sections.push(`## Available Structures\n\n${structures}`);
  }

  if (learnings) {
    sections.push(`## Learnings\n\n${learnings}`);
  }

  sections.push(`## Ideas to Write About\n\n${ideasText}`);

  sections.push(`## Task

For each idea:

1. Pick the strongest angle — the one with the most natural connection to Arkangel's work.
2. Choose a structure from the structures doc that fits.
3. Write two versions:
   - **X (Twitter):** Max 280 chars. Sharp and punchy.
   - **LinkedIn:** 5-15 lines. Narrative, personal, hook in first line.
4. Show metadata: angle used, structure used, pillar, sources from the summary.

Start with the most recent idea first.`);

  return sections.join("\n\n---\n\n");
}
