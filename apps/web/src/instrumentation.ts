/**
 * Next.js instrumentation hook — runs once at server boot.
 *
 * Importing `@second-brain/shared/env` triggers eager Zod validation of
 * serverEnv and publicEnv. A misconfigured deploy fails here instead of
 * surfacing as a 500 on the first user request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@second-brain/shared/env");
  }
}
