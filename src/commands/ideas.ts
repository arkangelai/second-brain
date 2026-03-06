import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
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

  let dbId = notionConfig.ideasDatabaseId;
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

    const vaultPath = config.vaultPath;
    const date = dateArg || todayISO();
    const fileSlug = options.week ? `week-${weekRange().start}` : date;

    // Fetch page bodies in parallel
    const pagesWithBody = await Promise.all(
      response.results.map(async (page: any) => ({
        page,
        body: await readPageBody(client, page.id),
      }))
    );

    // Fetch Healthcare Influencers
    let influencersDatabaseId = notionConfig.influencersDatabaseId;
    if (!influencersDatabaseId) {
      influencersDatabaseId = await detectInfluencersDatabase(client);
      if (influencersDatabaseId) {
        saveConfig({
          integrations: {
            ...config.integrations,
            notion: { ...notionConfig, ideasDatabaseId: dbId, influencersDatabaseId },
          },
        });
      }
    }

    let influencersMarkdown = "";
    if (influencersDatabaseId) {
      influencersMarkdown = await fetchInfluencers(client, influencersDatabaseId);
    }

    // Build markdown content
    const mdSections: string[] = [`# Ideas — ${fileSlug}\n`];

    for (const { page, body } of pagesWithBody) {
      const props = page.properties;
      const titulo = readPropertyValue(props.Titulo);
      const fecha = props.Fecha?.date?.start || "";
      const tipo = readPropertyValue(props.Tipo);
      const plataforma = readPropertyValue(props.Plataforma);

      mdSections.push(`## ${titulo}`);
      mdSections.push(`**Fecha:** ${fecha}  `);
      mdSections.push(`**Tipo:** ${tipo}  `);
      mdSections.push(`**Plataforma:** ${plataforma}\n`);

      if (body) mdSections.push(body);
      mdSections.push("");
    }

    if (influencersMarkdown) {
      mdSections.push("\n---\n");
      mdSections.push(influencersMarkdown);
    }

    const markdown = mdSections.join("\n");

    // Write to inbox
    const inboxDir = join(vaultPath, "00_inbox");
    mkdirSync(inboxDir, { recursive: true });
    const filePath = join(inboxDir, `ideas-${fileSlug}.md`);
    writeFileSync(filePath, markdown + "\n");

    success(`Saved to ${bold(`00_inbox/ideas-${fileSlug}.md`)}`);
    log(dim(`${response.results.length} idea(s) found.`));

    // ── Ask user if they want to generate posts ────────────────────────
    const shouldGenerate = options.generate || await askToGenerate();
    if (!shouldGenerate) return;

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

    const prompt = buildPostPrompt(ideasText, voiceProfile, structures, learnings, influencersMarkdown);

    console.log();

    // Try gateway first, fall back to claude CLI
    const apiKey = resolveApiKey();
    if (apiKey) {
      const model = resolveModel(options.model);
      log(bold("Generating posts via gateway..."));
      log(`Model: ${dim(model)}`);
      console.log();
      const output = await streamGatewayResponse(prompt, model, apiKey);
      saveGeneratedPost(vaultPath, fileSlug, output);
    } else if (checkCommand("claude", "Install Claude Code: https://docs.anthropic.com/en/docs/claude-code")) {
      log(bold("Generating posts via Claude CLI..."));
      console.log();
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
        process.exit(result.exitCode ?? 1);
      }
      const output = result.stdout.toString();
      saveGeneratedPost(vaultPath, fileSlug, output);
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

function saveGeneratedPost(vaultPath: string, date: string, content: string): void {
  const pipelineDir = join(vaultPath, "03_creating", "pipeline");
  mkdirSync(pipelineDir, { recursive: true });
  const postPath = join(pipelineDir, `posts-${date}.md`);
  writeFileSync(postPath, content.endsWith("\n") ? content : `${content}\n`);
  console.log();
  success(`Posts saved to ${bold(`03_creating/pipeline/posts-${date}.md`)}`);
  console.log();
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
      if (type === "heading_1") {
        lines.push(`## ${extractText(block[type].rich_text)}`);
      } else if (type === "heading_2") {
        lines.push(`### ${extractText(block[type].rich_text)}`);
      } else if (type === "heading_3") {
        lines.push(`#### ${extractText(block[type].rich_text)}`);
      } else if (type === "paragraph") {
        const text = extractText(block[type].rich_text);
        if (text) lines.push(text);
      } else if (type === "bulleted_list_item") {
        lines.push(`- ${extractText(block[type].rich_text)}`);
      } else if (type === "numbered_list_item") {
        lines.push(`1. ${extractText(block[type].rich_text)}`);
      } else if (type === "toggle") {
        lines.push(`- ${extractText(block[type].rich_text)}`);
      }

      if (block.has_children && (type === "toggle" || type === "bulleted_list_item" || type === "numbered_list_item")) {
        const childContent = await readPageBody(client, block.id);
        if (childContent) {
          lines.push(childContent.split("\n").map((l: string) => `  ${l}`).join("\n"));
        }
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

// Properties that identify an influencers database
const INFLUENCERS_REQUIRED_PROPERTIES: Record<string, string> = {
  Nombre: "title",
  Especialidad: "select",
  "Handle X": "rich_text",
  "Handle LinkedIn": "rich_text",
};

async function detectInfluencersDatabase(client: any): Promise<string | null> {
  const response: any = await client.search({
    filter: { property: "object", value: "database" },
  });

  for (const db of response.results) {
    const props = db.properties || {};
    const matches = Object.entries(INFLUENCERS_REQUIRED_PROPERTIES).every(
      ([name, type]) => props[name]?.type === type
    );
    if (matches) return db.id;
  }

  return null;
}

async function fetchInfluencers(client: any, databaseId: string): Promise<string> {
  const lines: string[] = ["## Healthcare Influencers\n"];
  lines.push("| Nombre | Especialidad | X | LinkedIn | Por qué importa |");
  lines.push("|--------|-------------|---|----------|-----------------|");

  let cursor: string | undefined;
  let hasResults = false;

  while (true) {
    const response: any = await client.databases.query({
      database_id: databaseId,
      page_size: 100,
      start_cursor: cursor,
    });

    for (const page of response.results) {
      const p = page.properties;
      const nombre = p.Nombre?.title?.[0]?.plain_text || "";
      if (!nombre) continue;
      const especialidad = p.Especialidad?.select?.name || "";
      const handleX = p["Handle X"]?.rich_text?.[0]?.plain_text || "";
      const segX = p["Seguidores X"]?.number || 0;
      const handleLI = p["Handle LinkedIn"]?.rich_text?.[0]?.plain_text || "";
      const segLI = p["Seguidores LinkedIn"]?.number || 0;
      const porque = p["Por que importa"]?.rich_text?.[0]?.plain_text || "";

      const xCol = handleX ? `${handleX} (${segX.toLocaleString()})` : "—";
      const liCol = handleLI ? `${handleLI} (${segLI.toLocaleString()})` : "—";
      lines.push(`| ${nombre} | ${especialidad} | ${xCol} | ${liCol} | ${porque} |`);
      hasResults = true;
    }

    if (!response.has_more) break;
    cursor = response.next_cursor;
  }

  return hasResults ? lines.join("\n") : "";
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
  learnings: string,
  influencers: string
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

  if (influencers) {
    sections.push(`## Healthcare Influencers\n\nThese influencers are relevant to the topics above. Consider tagging or referencing them when appropriate.\n\n${influencers}`);
  }

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
