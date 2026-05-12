#!/usr/bin/env bun
/**
 * Boot-time env validator. Run via `bun run check:env`.
 *
 * Validates the web app's serverEnv + publicEnv and the CLI's env in one
 * pass. Prints every missing/invalid var (not just the first), then exits
 * non-zero if any check failed.
 */

// Opt out of eager validation at import time so this script can collect
// failures from every scope instead of crashing on the first miss.
process.env.SKIP_ENV_VALIDATION = "1";

const { parsePublicEnv, parseServerEnv } = await import(
  "../packages/shared/src/env.ts"
);
const { parseCliEnv } = await import("../packages/cli/src/env.ts");

interface CheckResult {
  name: string;
  ok: boolean;
  error?: string;
}

function run(name: string, fn: () => void): CheckResult {
  try {
    fn();
    return { name, ok: true };
  } catch (err) {
    return {
      name,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

const results: CheckResult[] = [
  run("Web — serverEnv", () => {
    parseServerEnv();
  }),
  run("Web — publicEnv", () => {
    parsePublicEnv();
  }),
  run("CLI env", () => {
    parseCliEnv();
  }),
];

let failed = 0;
for (const result of results) {
  if (result.ok) {
    console.log(`✓ ${result.name}`);
    continue;
  }
  failed++;
  console.error(`✗ ${result.name}`);
  console.error(result.error?.replace(/^/gm, "  "));
  console.error();
}

if (failed > 0) {
  console.error(
    `\n${failed} env check${failed === 1 ? "" : "s"} failed. Fix the variables above and re-run.`
  );
  process.exit(1);
}

console.log("\nAll env checks passed.");
