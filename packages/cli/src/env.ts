import { z } from "zod";

const cliSchema = z
  .object({
    SECOND_BRAIN_URL: z
      .string()
      .url("must be a valid URL (e.g. https://second-brain.example.com)")
      .optional(),
    SECOND_BRAIN_API_KEY: z.string().min(1).optional(),
    SECOND_BRAIN_PATH: z.string().min(1).optional(),
    AI_GATEWAY_API_KEY: z.string().min(1).optional(),
  })
  .refine(
    (env) => Boolean(env.SECOND_BRAIN_URL) === Boolean(env.SECOND_BRAIN_API_KEY),
    {
      message:
        "SECOND_BRAIN_URL and SECOND_BRAIN_API_KEY must be set together for remote mode, or both omitted for local mode.",
      path: ["SECOND_BRAIN_URL"],
    }
  );

export type CliMode = "local" | "remote";

export interface CliEnv {
  mode: CliMode;
  remoteUrl?: string;
  remoteApiKey?: string;
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
 * Parse a CLI env source. Returns mode "remote" when both SECOND_BRAIN_URL
 * and SECOND_BRAIN_API_KEY are set; "local" when both are omitted; throws
 * with a readable error when exactly one of the pair is set.
 */
export function parseCliEnv(
  source: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): CliEnv {
  const normalized = {
    SECOND_BRAIN_URL: clean(source.SECOND_BRAIN_URL),
    SECOND_BRAIN_API_KEY: clean(source.SECOND_BRAIN_API_KEY),
    SECOND_BRAIN_PATH: clean(source.SECOND_BRAIN_PATH),
    AI_GATEWAY_API_KEY: clean(source.AI_GATEWAY_API_KEY),
  };

  const result = cliSchema.safeParse(normalized);
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }

  const data = result.data;
  const mode: CliMode =
    data.SECOND_BRAIN_URL && data.SECOND_BRAIN_API_KEY ? "remote" : "local";

  return {
    mode,
    remoteUrl: data.SECOND_BRAIN_URL,
    remoteApiKey: data.SECOND_BRAIN_API_KEY,
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
