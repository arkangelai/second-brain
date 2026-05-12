import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z
    .string()
    .min(1, "must be set (Supabase project settings → API Keys → Secret keys, sb_secret_...)"),
  AI_GATEWAY_API_KEY: z
    .string()
    .min(1, "must be set (Vercel dashboard → AI Gateway → API keys)"),
  RESEND_API_KEY: optionalNonEmptyString,
  APP_URL: z
    .string()
    .url("must be a valid URL (e.g. https://second-brain.example.com)"),
  EMAIL_FROM: z
    .string()
    .email("must be a valid email address (e.g. noreply@example.com)"),
  EMAIL_REPLY_TO: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .email("must be a valid email address (e.g. support@example.com)")
      .optional()
  ),
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
        "NEXT_PUBLIC_SUPABASE_ANON_KEY looks like a Supabase secret key (service_role JWT or sb_secret_*) — never expose it to the browser. Use the anon/publishable key instead.",
      path: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    }
  );

export type ServerEnv = z.infer<typeof serverSchema>;
export type PublicEnv = z.infer<typeof publicSchema>;

/**
 * Detect Supabase secret keys that must never reach the browser.
 *
 * Covers both supported key formats:
 *   - Legacy JWT keys (`eyJ...`) whose payload carries `"role":"service_role"`.
 *     The anon key carries `"role":"anon"`. We decode the payload (no signature
 *     check needed — we just inspect the claim).
 *   - 2025+ API keys: `sb_secret_...` is the secret key, `sb_publishable_...`
 *     is the browser-safe one.
 *
 * A misconfigured deploy that pastes a secret key into `NEXT_PUBLIC_*` fails
 * loudly here instead of leaking it to every browser.
 */
function looksLikeServiceRoleKey(value: string): boolean {
  if (value.startsWith("sb_secret_")) return true;

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
 *
 * NOTE: each `NEXT_PUBLIC_*` is referenced statically by name. Next.js only
 * inlines `process.env.NEXT_PUBLIC_*` into the browser bundle via static
 * substitution — passing `process.env` as a whole object would yield `{}`
 * in the browser and fail validation on every page load.
 */
export const publicEnv: PublicEnv = shouldSkipValidation
  ? ({} as PublicEnv)
  : parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    });

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
