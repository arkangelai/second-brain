import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from "fs";
import { join, relative } from "path";
import { success, warn, dim } from "./utils.ts";

/**
 * Recursively copy files from src to dest, never overwriting existing files.
 * Returns count of files copied.
 */
export function copyTemplates(src: string, dest: string): number {
  if (!existsSync(src)) return 0;

  let copied = 0;

  function walk(currentSrc: string, currentDest: string) {
    const entries = readdirSync(currentSrc, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = join(currentSrc, entry.name);
      const destPath = join(currentDest, entry.name);

      if (entry.isDirectory()) {
        mkdirSync(destPath, { recursive: true });
        walk(srcPath, destPath);
      } else {
        if (existsSync(destPath)) {
          // no-clobber: skip existing files
          continue;
        }
        mkdirSync(currentDest, { recursive: true });
        copyFileSync(srcPath, destPath);
        copied++;
      }
    }
  }

  walk(src, dest);
  return copied;
}
