import { listSocialAccounts } from "../api.js";
import { saveConfig, loadConfig, TIMEZONE, DEFAULT_POSTING_TIME } from "../config.js";
import type { LocalConfig } from "../config.js";

export async function accountsCommand(): Promise<void> {
  console.log("Fetching social accounts from Post-Bridge...\n");

  const accounts = await listSocialAccounts();

  if (accounts.length === 0) {
    console.log("No social accounts found. Connect accounts at https://app.post-bridge.com");
    return;
  }

  const config: LocalConfig = loadConfig() ?? {
    accounts: {},
    timezone: TIMEZONE,
    defaultPostingTime: DEFAULT_POSTING_TIME,
  };

  console.log("Connected accounts:");
  console.log("─".repeat(50));

  for (const account of accounts) {
    const platform = account.platform.toLowerCase();
    const label = `${account.platform} — @${account.username || account.name}`;
    console.log(`  [${account.id}] ${label}`);

    if (platform === "twitter" || platform === "x") {
      config.accounts.twitter = { id: account.id, username: account.username || account.name };
    } else if (platform === "linkedin") {
      config.accounts.linkedin = { id: account.id, username: account.username || account.name };
    }
  }

  saveConfig(config);
  console.log(`\nConfig saved. Twitter ID: ${config.accounts.twitter?.id ?? "—"}, LinkedIn ID: ${config.accounts.linkedin?.id ?? "—"}`);
}
