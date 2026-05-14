/**
 * Next.js instrumentation hook — runs once at server boot.
 *
 * Importing `@second-brain/shared/env` triggers eager Zod validation of
 * publicEnv. Server-only values are validated lazily when code reads
 * serverEnv so build-time page collection does not require unrelated
 * runtime-only secrets.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@second-brain/shared/env");
  }
}
