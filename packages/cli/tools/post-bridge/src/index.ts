import { accountsCommand } from "./commands/accounts.js";
import { previewCommand } from "./commands/preview.js";
import { scheduleCommand } from "./commands/schedule.js";
import { scheduleWeekCommand } from "./commands/schedule-week.js";
import { listCommand } from "./commands/list.js";
import { cancelCommand } from "./commands/cancel.js";
import { resultsCommand } from "./commands/results.js";

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  accounts: accountsCommand,
  preview: previewCommand,
  schedule: scheduleCommand,
  "schedule-week": scheduleWeekCommand,
  list: listCommand,
  cancel: cancelCommand,
  results: resultsCommand,
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`Unknown command: ${command}\n`);
    printHelp();
    process.exit(1);
  }

  try {
    await handler(args.slice(1));
  } catch (err) {
    console.error(`\nError: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Post-Bridge CLI — Schedule social media posts from the content pipeline

Usage: bun run <command> [-- args]

Commands:
  accounts                          List + cache social account IDs
  preview <file>                    Show what would be posted (no API call)
  schedule <file> --date YYYY-MM-DD Schedule one post
  schedule-week [--start DATE]      Auto-schedule ready posts Mon-Fri
  list [--status scheduled|published] List posts on Post-Bridge
  cancel <post-id>                  Cancel a scheduled post
  results [--post-id ID]            Check publish results

Environment:
  POST_BRIDGE_API_KEY               Required. Set in ~/.secrets/.env
`);
}

main();
