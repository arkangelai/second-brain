import { parseArgs } from "util";
import { log, error, bold, dim } from "./utils.ts";
import { init } from "./commands/init.ts";
import { update } from "./commands/update.ts";
import { status } from "./commands/status.ts";
import { search } from "./commands/search.ts";
import { create } from "./commands/create.ts";
import { draft } from "./commands/draft.ts";
import { publish } from "./commands/publish.ts";
import { pull } from "./commands/pull.ts";
import { ideas } from "./commands/ideas.ts";
import { configCmd } from "./commands/config-cmd.ts";

const VERSION = "0.1.0";

const HELP = `
  ${bold("second-brain")} - AI-native knowledge management CLI

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
    publish                    Push ready pipeline posts to Notion
    publish "file.md"          Push a specific post to Notion
    publish setup              Guided Notion integration setup
    pull                       Pull Notion metrics into published local posts
    pull "file.md"             Pull metrics for a specific post
    ideas                      Show content ideas from Notion for today
    ideas "YYYY-MM-DD"         Show ideas for a specific date
    ideas --week               Show ideas for this week
    config <set|get> ...       Manage local second-brain config

  ${bold("Options:")}
    --vault <path>             Override vault path
    --agent <name>             Agent for draft: claude, cursor, codex, gateway
    --model <id>               Model id for gateway draft requests
    --dry-run                  Preview publish/pull actions without writing
    --force                    Re-publish even when hash matches
    --all                      Publish all pipeline posts regardless of status
    --status <value>           Publish only posts with this status
    --version, -v              Show version
    --help, -h                 Show this help

  ${bold("Vault path resolution:")}
    --vault flag > $SECOND_BRAIN_PATH > ~/.config/second-brain/config.json > ~/Documents/Second_Brain
`;

export async function run(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      vault: { type: "string" },
      agent: { type: "string" },
      model: { type: "string" },
      status: { type: "string" },
      "dry-run": { type: "boolean" },
      force: { type: "boolean" },
      all: { type: "boolean" },
      week: { type: "boolean" },
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
      await draft(
        positionals.slice(1).join(" "),
        values.agent as string | undefined,
        vaultFlag,
        values.model as string | undefined
      );
      break;

    case "config":
      configCmd(
        positionals[1],
        positionals[2],
        positionals.slice(3).join(" ")
      );
      break;

    case "publish":
      await publish(
        positionals[1],
        {
          dryRun: Boolean(values["dry-run"]),
          force: Boolean(values.force),
          all: Boolean(values.all),
          status: values.status as string | undefined,
        },
        vaultFlag
      );
      break;

    case "pull":
      await pull(
        positionals[1],
        {
          dryRun: Boolean(values["dry-run"]),
        },
        vaultFlag
      );
      break;

    case "ideas":
      await ideas(
        positionals[1],
        { week: Boolean(values.week) },
        vaultFlag
      );
      break;

    default:
      error(`Unknown command: ${command}`);
      log(`Run ${dim("second-brain --help")} for usage.`);
      process.exit(1);
  }
}
