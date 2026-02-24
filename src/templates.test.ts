import { afterEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { copyTemplates } from "./templates.ts";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("copyTemplates", () => {
  it("copies files recursively and returns count", () => {
    const src = makeTempDir("sb-src-");
    const dest = makeTempDir("sb-dest-");

    mkdirSync(join(src, "nested"), { recursive: true });
    writeFileSync(join(src, "a.md"), "A");
    writeFileSync(join(src, "nested", "b.md"), "B");

    const copied = copyTemplates(src, dest);
    expect(copied).toBe(2);
    expect(readFileSync(join(dest, "a.md"), "utf-8")).toBe("A");
    expect(readFileSync(join(dest, "nested", "b.md"), "utf-8")).toBe("B");
  });

  it("does not clobber existing destination files", () => {
    const src = makeTempDir("sb-src-");
    const dest = makeTempDir("sb-dest-");

    writeFileSync(join(src, "a.md"), "new");
    writeFileSync(join(dest, "a.md"), "old");

    const copied = copyTemplates(src, dest);
    expect(copied).toBe(0);
    expect(readFileSync(join(dest, "a.md"), "utf-8")).toBe("old");
  });

  it("returns 0 when source does not exist", () => {
    const src = join(makeTempDir("sb-src-"), "missing");
    const dest = makeTempDir("sb-dest-");
    expect(existsSync(src)).toBe(false);
    expect(copyTemplates(src, dest)).toBe(0);
  });
});
