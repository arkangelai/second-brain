import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

interface CliHarness {
  run: (argv: string[]) => Promise<void>;
  commands: {
    init: ReturnType<typeof mock>;
    update: ReturnType<typeof mock>;
    status: ReturnType<typeof mock>;
    search: ReturnType<typeof mock>;
    create: ReturnType<typeof mock>;
    draft: ReturnType<typeof mock>;
    publish: ReturnType<typeof mock>;
    pull: ReturnType<typeof mock>;
    configCmd: ReturnType<typeof mock>;
  };
  utils: {
    log: ReturnType<typeof mock>;
    error: ReturnType<typeof mock>;
  };
}

async function loadCliHarness(): Promise<CliHarness> {
  const init = mock(() => {});
  const update = mock(() => {});
  const status = mock(() => {});
  const search = mock(() => {});
  const create = mock(() => {});
  const draft = mock(async () => {});
  const publish = mock(async () => {});
  const pull = mock(async () => {});
  const configCmd = mock(() => {});
  const log = mock(() => {});
  const error = mock(() => {});

  mock.module("./commands/init.ts", () => ({ init }));
  mock.module("./commands/update.ts", () => ({ update }));
  mock.module("./commands/status.ts", () => ({ status }));
  mock.module("./commands/search.ts", () => ({ search }));
  mock.module("./commands/create.ts", () => ({ create }));
  mock.module("./commands/draft.ts", () => ({ draft }));
  mock.module("./commands/publish.ts", () => ({ publish }));
  mock.module("./commands/pull.ts", () => ({ pull }));
  mock.module("./commands/config-cmd.ts", () => ({ configCmd }));
  mock.module("./utils.ts", () => ({
    log,
    error,
    bold: (s: string) => s,
    dim: (s: string) => s,
  }));

  const mod = await import(`./cli.ts?cli-${Date.now()}-${Math.random()}`);

  return {
    run: mod.run,
    commands: { init, update, status, search, create, draft, publish, pull, configCmd },
    utils: { log, error },
  };
}

afterEach(() => {
  mock.restore();
});

describe("cli run", () => {
  it("prints version", async () => {
    const { run } = await loadCliHarness();
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    await run(["--version"]);
    expect(logSpy).toHaveBeenCalledWith("0.1.0");
  });

  it("prints help with --help and with no args", async () => {
    let harness = await loadCliHarness();
    let logSpy = spyOn(console, "log").mockImplementation(() => {});
    await harness.run(["--help"]);
    expect(logSpy).toHaveBeenCalled();

    harness = await loadCliHarness();
    logSpy = spyOn(console, "log").mockImplementation(() => {});
    await harness.run([]);
    expect(logSpy).toHaveBeenCalled();
  });

  it("routes sync commands", async () => {
    let h = await loadCliHarness();
    await h.run(["init", "--vault", "/v"]);
    expect(h.commands.init).toHaveBeenCalledWith("/v");

    h = await loadCliHarness();
    await h.run(["update"]);
    expect(h.commands.update).toHaveBeenCalled();

    h = await loadCliHarness();
    await h.run(["status"]);
    expect(h.commands.status).toHaveBeenCalled();

    h = await loadCliHarness();
    await h.run(["search", "hello", "world"]);
    expect(h.commands.search).toHaveBeenCalledWith("hello world");

    h = await loadCliHarness();
    await h.run(["create", "note", "my", "title"]);
    expect(h.commands.create).toHaveBeenCalledWith("note", "my title", undefined);

    h = await loadCliHarness();
    await h.run(["config", "set", "apiKey", "value"]);
    expect(h.commands.configCmd).toHaveBeenCalledWith("set", "apiKey", "value");
  });

  it("routes async draft/publish/pull commands with flags", async () => {
    let h = await loadCliHarness();
    await h.run(["draft", "topic", "--agent", "gateway", "--model", "m", "--vault", "/v"]);
    expect(h.commands.draft).toHaveBeenCalledWith("topic", "gateway", "/v", "m");

    h = await loadCliHarness();
    await h.run(["publish", "post.md", "--dry-run", "--force", "--all", "--status", "ready", "--vault", "/v"]);
    expect(h.commands.publish).toHaveBeenCalledWith(
      "post.md",
      {
        dryRun: true,
        force: true,
        all: true,
        status: "ready",
      },
      "/v"
    );

    h = await loadCliHarness();
    await h.run(["pull", "post.md", "--dry-run", "--vault", "/v"]);
    expect(h.commands.pull).toHaveBeenCalledWith(
      "post.md",
      {
        dryRun: true,
      },
      "/v"
    );
  });

  it("exits on unknown commands", async () => {
    const h = await loadCliHarness();
    const exitSpy = spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);

    await expect(h.run(["unknown"])).rejects.toThrow("exit");
    expect(h.utils.error).toHaveBeenCalledWith("Unknown command: unknown");
    expect(h.utils.log).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
