import { parseArgs } from "util";
import { log, error, bold, dim } from "./utils.ts";
import { init } from "./commands/init.ts";
import { update } from "./commands/update.ts";
import { status } from "./commands/status.ts";
import { search } from "./commands/search.ts";
import { create } from "./commands/create.ts";
import { draft } from "./commands/draft.ts";
import { configCmd } from "./commands/config-cmd.ts";

const VERSION = "0.1.0";

const HELP = `
  ${bold("second-brain")} — AI-native knowledge management CLI

  ${bold("Usage:")}
    second-brain <command> [options]

  ${bold("Commands:")}
    init                       Set up vault, install QMD, index
    update                     Copy new templates, update QMD, re-index
    status                     Vault stats and QMD health
    search "query"             Search vault via QMD hybrid search
    create note "title"        Scaffold a new note
    create post "title"        Scaffold a new pipeline post
    draft "topic"              Search vault, assemble prompt, launch agent
    config <set|get> ...       Manage local second-brain config

  ${bold("Options:")}
    --vault <path>             Override vault path
    --agent <name>             Agent for draft: claude, cursor, codex, gateway
    --model <id>               Model id for gateway draft requests
    --version, -v              Show version
    --help, -h                 Show this help

  ${bold("Vault path resolution:")}
    --vault flag > $SECOND_BRAIN_PATH > ~/.config/second-brain/config.json > ~/Documents/Second_Brain
`;

export function run(argv: string[]): void {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      vault: { type: "string" },
      agent: { type: "string" },
      model: { type: "string" },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.version) {
    console.log(VERSION);
    return;
  }

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    return;
  }

  const command = positionals[0];
  const vaultFlag = values.vault as string | undefined;

  switch (command) {
    case "init":
      init(vaultFlag);
      break;

    case "update":
      update(vaultFlag);
      break;

    case "status":
      status(vaultFlag);
      break;

    case "search":
      search(positionals.slice(1).join(" "));
      break;

    case "create":
      create(positionals[1], positionals.slice(2).join(" "), vaultFlag);
      break;

    case "draft":
      draft(
        positionals.slice(1).join(" "),
        values.agent as string | undefined,
        vaultFlag,
        values.model as string | undefined
      ).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        error(message);
        process.exit(1);
      });
      break;

    case "config":
      configCmd(
        positionals[1],
        positionals[2],
        positionals.slice(3).join(" ")
      );
      break;

    default:
      error(`Unknown command: ${command}`);
      log(`Run ${dim("second-brain --help")} for usage.`);
      process.exit(1);
  }
}
