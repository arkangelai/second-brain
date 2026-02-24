import { log, success, warn, error, bold, dim } from "../utils.ts";
import { loadConfig, saveConfig, resolveModel } from "../config.ts";

function usage(): void {
  log(`Usage: ${dim("second-brain config set apiKey \"<value>\"")}`);
  log(`       ${dim("second-brain config set model \"<value>\"")}`);
  log(`       ${dim("second-brain config get apiKey")}`);
  log(`       ${dim("second-brain config get model")}`);
}

function normalize(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
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

    const normalized = normalize(value);
    if (!normalized) {
      error("Missing value.");
      usage();
      process.exit(1);
    }

    if (key === "apiKey") {
      saveConfig({ aiGatewayApiKey: normalized });
      success("AI Gateway API key saved");
      return;
    }

    saveConfig({ defaultModel: normalized });
    success(`Default model saved: ${bold(normalized)}`);
    return;
  }

  if (!key || !["apiKey", "model"].includes(key)) {
    error(`Invalid config key: ${key || "(none)"}`);
    usage();
    process.exit(1);
  }

  const config = loadConfig();

  if (key === "apiKey") {
    const apiKey = config.aiGatewayApiKey;
    if (!apiKey) {
      warn("No API key set in config.");
      log(`Configure it with ${dim('second-brain config set apiKey "<key>"')}`);
      return;
    }
    log(`AI Gateway API key: ${bold(maskApiKey(apiKey))}`);
    return;
  }

  const configuredModel = config.defaultModel;
  if (configuredModel) {
    log(`Default model: ${bold(configuredModel)}`);
    return;
  }

  log(`Default model: ${bold(resolveModel())} ${dim("(builtin default)")}`);
}
