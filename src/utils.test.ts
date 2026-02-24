import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import {
  bold,
  cyan,
  dim,
  exec,
  execLive,
  checkCommand,
  green,
  requireCommand,
  red,
  slugify,
  yellow,
} from "./utils.ts";

afterEach(() => {
  mock.restore();
});

describe("slugify", () => {
  it("converts to lowercase with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(slugify("AI & ML!")).toBe("ai-ml");
  });

  it("collapses repeated hyphens and trims edges", () => {
    expect(slugify("  a---b  ")).toBe("a-b");
  });

  it("returns empty for empty input", () => {
    expect(slugify("")).toBe("");
  });
});

describe("color helpers", () => {
  it("passthrough when NO_COLOR is set", () => {
    expect(bold("x")).toBe("x");
    expect(dim("x")).toBe("x");
    expect(green("x")).toBe("x");
    expect(red("x")).toBe("x");
    expect(yellow("x")).toBe("x");
    expect(cyan("x")).toBe("x");
  });
});

describe("exec helpers", () => {
  it("exec returns ok=true for zero exit code", () => {
    const result = exec(["sh", "-c", "echo out; echo err 1>&2"]);

    expect(result).toEqual({
      ok: true,
      stdout: "out",
      stderr: "err",
      exitCode: 0,
    });
  });

  it("exec returns ok=false for non-zero exit code", () => {
    const result = exec(["sh", "-c", "echo boom 1>&2; exit 2"]);

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe("boom");
  });

  it("execLive returns process exit code", () => {
    expect(execLive(["sh", "-c", "exit 7"])).toBe(7);
  });

  it("checkCommand returns true when command is found", () => {
    expect(checkCommand("sh", "install sh")).toBe(true);
  });

  it("checkCommand returns false and logs when missing", () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const errSpy = spyOn(console, "error").mockImplementation(() => {});

    expect(checkCommand("definitely-not-a-real-command-xyz", "install qmd")).toBe(false);
    expect(errSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });

  it("requireCommand exits when command is missing", () => {
    spyOn(console, "log").mockImplementation(() => {});
    spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);

    expect(() =>
      requireCommand("definitely-not-a-real-command-xyz", "install qmd")
    ).toThrow("exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe("execLive import sanity", () => {
  it("keeps original import usable", () => {
    expect(typeof execLive).toBe("function");
  });
});
