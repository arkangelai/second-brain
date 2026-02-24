import { log, success, warn, error, bold, dim } from "../utils.ts";
import { loadConfig, saveConfig, resolveModel } from "../config.ts";

function usage(): void {
  log(`Usage: ${dim("second-brain config set apiKey \"<value>\"")}`);
  log(`       ${dim("second-brain config set model \"<value>\"")}`);
  log(`       ${dim("second-brain config get apiKey")}`);
  log(`       ${dim("second-brain config get model")}`);
}

function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "*".repeat(trimmed.length);
  return `${trimmed.slice(0, 4)}${"*".repeat(trimmed.length - 8)}${trimmed.slice(-4)}`;
}

export function configCmd(
  action?: string,
  key?: string,
  value?: string
): void {
  if (!action || !["set", "get"].includes(action)) {
    error(`Invalid config action: ${action || "(none)"}`);
    usage();
    process.exit(1);
  }

  if (action === "set") {
    if (!key || !["apiKey", "model"].includes(key)) {
      error(`Invalid config key: ${key || "(none)"}`);
      usage();
      process.exit(1);
    }

    if (!value) {
      error("Missing value.");
      usage();
      process.exit(1);
    }

    if (key === "apiKey") {
      saveConfig({ aiGatewayApiKey: value.trim() });
      success("AI Gateway API key saved");
      return;
    }

    saveConfig({ defaultModel: value.trim() });
    success(`Default model saved: ${bold(value.trim())}`);
    return;
  }

  if (!key || !["apiKey", "model"].includes(key)) {
    error(`Invalid config key: ${key || "(none)"}`);
    usage();
    process.exit(1);
  }

  const config = loadConfig();

  if (key === "apiKey") {
    const apiKey = config.aiGatewayApiKey?.trim();
    if (!apiKey) {
      warn("No API key set in config.");
      return;
    }
    log(`AI Gateway API key: ${bold(maskApiKey(apiKey))}`);
    return;
  }

  const configuredModel = config.defaultModel?.trim();
  if (configuredModel) {
    log(`Default model: ${bold(configuredModel)}`);
    return;
  }

  log(`Default model: ${bold(resolveModel())} ${dim("(builtin default)")}`);
}
