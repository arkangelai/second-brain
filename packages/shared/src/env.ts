import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "must be set (Supabase project settings → API → service_role key)"),
  AI_GATEWAY_API_KEY: z
    .string()
    .min(1, "must be set (Vercel dashboard → AI Gateway → API keys)"),
  RESEND_API_KEY: z
    .string()
    .min(1, "must be set (resend.com → API Keys)"),
  APP_URL: z
    .string()
    .url("must be a valid URL (e.g. https://second-brain.example.com)"),
  EMAIL_FROM: z
    .string()
    .email("must be a valid email address (e.g. noreply@example.com)"),
});

const publicSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z
      .string()
      .url("must be a valid URL (Supabase project settings → API → URL)"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z
      .string()
      .min(1, "must be set (Supabase project settings → API → anon/public key)"),
    NEXT_PUBLIC_APP_NAME: z
      .string()
      .min(1, "must be set (display name shown in the UI)"),
  })
  .refine(
    (env) => !looksLikeServiceRoleKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      message:
        "NEXT_PUBLIC_SUPABASE_ANON_KEY decodes to a service_role JWT — never expose the service role key to the browser. Use the anon/public key instead.",
      path: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    }
  );

export type ServerEnv = z.infer<typeof serverSchema>;
export type PublicEnv = z.infer<typeof publicSchema>;

/**
 * Detect Supabase service-role JWTs.
 *
 * Service-role keys are JWTs (eyJ... prefix) whose payload carries
 * `"role":"service_role"`. The anon key carries `"role":"anon"`. We decode the
 * payload (no signature check needed — we just inspect the claim) so a
 * misconfigured deploy that pastes the service-role key into `NEXT_PUBLIC_*`
 * fails loudly instead of leaking it to every browser.
 */
function looksLikeServiceRoleKey(value: string): boolean {
  if (!value.startsWith("eyJ")) return false;

  const parts = value.split(".");
  if (parts.length !== 3) return false;

  try {
    const payload = decodeBase64Url(parts[1]);
    return /"role"\s*:\s*"service_role"/.test(payload);
  } catch {
    return false;
  }
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  return atob(normalized + "=".repeat(padding));
}

function formatZodError(scope: string, error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    return `  - ${path}: ${issue.message}`;
  });
  return [
    `Invalid ${scope} environment variables:`,
    ...lines,
    "",
    "See .env.example for the full list and where to get each value.",
  ].join("\n");
}

/**
 * Validate a server-side env source. Throws with every missing/invalid var
 * listed, not just the first one.
 */
export function parseServerEnv(
  source: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): ServerEnv {
  const result = serverSchema.safeParse(source);
  if (!result.success) {
    throw new Error(formatZodError("server", result.error));
  }
  return result.data;
}

/**
 * Validate a browser-safe env source. Throws with every missing/invalid var
 * listed, not just the first one.
 */
export function parsePublicEnv(
  source: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): PublicEnv {
  const result = publicSchema.safeParse(source);
  if (!result.success) {
    throw new Error(formatZodError("public", result.error));
  }
  return result.data;
}

const isServer = typeof window === "undefined";
const shouldSkipValidation =
  typeof process !== "undefined" &&
  process.env?.SKIP_ENV_VALIDATION === "1";

const emptyServerEnv = (): ServerEnv =>
  new Proxy({} as ServerEnv, {
    get(_target, prop) {
      throw new Error(
        `serverEnv.${String(prop)} cannot be read on the client. Move this code to a Server Component, Route Handler, or Server Action.`
      );
    },
  });

/**
 * Browser-safe env. Validated at module import so misconfigurations surface
 * at boot. Set `SKIP_ENV_VALIDATION=1` in build steps or test harnesses that
 * need to import the parser functions without triggering validation.
 */
export const publicEnv: PublicEnv = shouldSkipValidation
  ? ({} as PublicEnv)
  : parsePublicEnv();

/**
 * Server-only env. Importing this module on the client never validates the
 * server schema; accessing any property from the client throws to make
 * accidental leakage impossible.
 */
export const serverEnv: ServerEnv = shouldSkipValidation
  ? ({} as ServerEnv)
  : isServer
    ? parseServerEnv()
    : emptyServerEnv();
