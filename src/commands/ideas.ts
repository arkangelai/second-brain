import { resolveConfig } from "../config.ts";
import { createNotionClient, readPropertyValue } from "../notion.ts";
import { bold, dim, error, log, warn } from "../utils.ts";

export interface IdeasOptions {
  week?: boolean;
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

  const dbId = (notionConfig as any).ideasDatabaseId;
  if (!dbId) {
    error("Ideas database is not configured.");
    log(
      `Run ${dim(
        'second-brain config set ideasDatabaseId "<your-database-id>"'
      )} to set it.`
    );
    process.exit(1);
  }

  const client = createNotionClient(notionConfig);
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

    for (const page of response.results) {
      const props = page.properties;
      const titulo = readPropertyValue(props.Titulo);
      const fecha = props.Fecha?.date?.start || "";
      const status = readPropertyValue(props.Status);
      const tipo = readPropertyValue(props.Tipo);
      const plataforma = readPropertyValue(props.Plataforma);
      const resumen = readPropertyValue(props.Resumen);
      const angulos = readPropertyValue(props["Angulos de Contenido"]);

      log(bold(titulo));
      if (fecha) log(`  Fecha:      ${dim(fecha)}`);
      if (status) log(`  Status:     ${dim(status)}`);
      if (tipo) log(`  Tipo:       ${dim(tipo)}`);
      if (plataforma) log(`  Plataforma: ${dim(plataforma)}`);
      if (resumen) log(`  Resumen:    ${resumen}`);
      if (angulos) log(`  Angulos:    ${angulos}`);
      console.log();
    }

    log(dim(`${response.results.length} idea(s) found.`));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(`Failed to query ideas: ${message}`);
    process.exit(1);
  }
}
