import { log, error, bold, dim, requireQmd, execLive } from "../utils.ts";

export function search(query: string): void {
  if (!query) {
    error("Missing search query.");
    log(`Usage: ${dim("second-brain search \"your query\"")}`);
    process.exit(1);
  }

  requireQmd();

  const exitCode = execLive([
    "qmd",
    "query",
    query,
    "-c",
    "second-brain",
  ]);

  process.exit(exitCode);
}
