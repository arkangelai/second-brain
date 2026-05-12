import { z } from "zod";

const cliSchema = z.object({
  SECOND_BRAIN_PATH: z.string().min(1).optional(),
  AI_GATEWAY_API_KEY: z.string().min(1).optional(),
});

export type CliMode = "local";

export interface CliEnv {
  mode: CliMode;
  vaultPath?: string;
  aiGatewayApiKey?: string;
}

function clean(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function formatZodError(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    return `  - ${path}: ${issue.message}`;
  });
  return [
    "Invalid CLI environment variables:",
    ...lines,
    "",
    "See .env.example for the full list of CLI variables.",
  ].join("\n");
}

/**
 * Parse a CLI env source. The CLI is local-first today; app-issued remote
 * API tokens will be introduced with the Supabase-backed auth flow.
 */
export function parseCliEnv(
  source: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): CliEnv {
  const normalized = {
    SECOND_BRAIN_PATH: clean(source.SECOND_BRAIN_PATH),
    AI_GATEWAY_API_KEY: clean(source.AI_GATEWAY_API_KEY),
  };

  const result = cliSchema.safeParse(normalized);
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }

  const data = result.data;

  return {
    mode: "local",
    vaultPath: data.SECOND_BRAIN_PATH,
    aiGatewayApiKey: data.AI_GATEWAY_API_KEY,
  };
}

const shouldSkipValidation =
  typeof process !== "undefined" &&
  process.env?.SKIP_ENV_VALIDATION === "1";

export const cliEnv: CliEnv = shouldSkipValidation
  ? { mode: "local" }
  : parseCliEnv();
