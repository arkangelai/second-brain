#!/usr/bin/env bun

import { run } from "../src/cli.ts";

run(process.argv.slice(2)).catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  console.error(message);
  process.exit(1);
});
