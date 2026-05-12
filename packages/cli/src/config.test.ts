import { afterEach, describe, expect, it, mock } from "bun:test";

interface ConfigHarness {
  mod: typeof import("./config.ts");
  configFile: string;
  home: string;
  fs: {
    existsSync: ReturnType<typeof mock>;
    mkdirSync: ReturnType<typeof mock>;
    readFileSync: ReturnType<typeof mock>;
    writeFileSync: ReturnType<typeof mock>;
  };
}

async function loadConfigHarness(storedConfig?: unknown): Promise<ConfigHarness> {
  const home = "/tmp/test-home";
  const configFile = `${home}/.config/second-brain/config.json`;
  const files = new Map<string, string>();

  if (storedConfig !== undefined) {
    files.set(configFile, JSON.stringify(storedConfig));
  }

  const existsSync = mock((pathLike: unknown) => files.has(String(pathLike)));
  const mkdirSync = mock(() => {});
  const readFileSync = mock((pathLike: unknown) => files.get(String(pathLike)) ?? "");
  const writeFileSync = mock((pathLike: unknown, content: unknown) => {
    files.set(String(pathLike), String(content));
  });

  mock.module("os", () => ({
    homedir: () => home,
  }));

  mock.module("fs", () => ({
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
  }));

  const mod = await import(`./config.ts?config-${Date.now()}-${Math.random()}`);
  return {
    mod,
    configFile,
    home,
    fs: {
      existsSync,
      mkdirSync,
      readFileSync,
      writeFileSync,
    },
  };
}

afterEach(() => {
  delete process.env.SECOND_BRAIN_PATH;
  delete process.env.NOTION_API_TOKEN;
  delete process.env.AI_GATEWAY_API_KEY;
  mock.restore();
});

describe("resolveEnvValue", () => {
  it("resolves $ENV_VAR references", async () => {
    const { mod } = await loadConfigHarness();
    process.env.NOTION_API_TOKEN = "abc123";
    expect(mod.resolveEnvValue("$NOTION_API_TOKEN")).toBe("abc123");
  });

  it("returns empty for bare $ and undefined", async () => {
    const { mod } = await loadConfigHarness();
    expect(mod.resolveEnvValue("$")).toBe("");
    expect(mod.resolveEnvValue(undefined)).toBe("");
  });

  it("returns literal when value is not an env reference", async () => {
    const { mod } = await loadConfigHarness();
    expect(mod.resolveEnvValue("literal")).toBe("literal");
  });
});

describe("resolveConfig", () => {
  it("uses priority flag > env > config > default", async () => {
    const { mod, home } = await loadConfigHarness({ vaultPath: "/from-config" });
    process.env.SECOND_BRAIN_PATH = "/from-env";

    expect(mod.resolveConfig("~/from-flag").vaultPath).toBe(`${home}/from-flag`);
    expect(mod.resolveConfig().vaultPath).toBe("/from-env");

    delete process.env.SECOND_BRAIN_PATH;
    expect(mod.resolveConfig().vaultPath).toBe("/from-config");
  });

  it("falls back to ~/Documents/Second_Brain", async () => {
    const { mod, home } = await loadConfigHarness();
    expect(mod.resolveConfig().vaultPath).toBe(`${home}/Documents/Second_Brain`);
  });

  it("resolves Notion auth env refs and default bodyMap", async () => {
    process.env.NOTION_API_TOKEN = "token-1";
    const { mod } = await loadConfigHarness({
      integrations: {
        notion: {
          databaseId: "db",
          auth: "$NOTION_API_TOKEN",
          propertyMap: [],
        },
      },
    });

    const resolved = mod.resolveConfig();
    expect(resolved.integrations?.notion?.auth).toBe("token-1");
    expect(resolved.integrations?.notion?.bodyMap).toBeDefined();
  });
});

describe("resolveModel and resolveApiKey", () => {
  it("resolveModel uses flag > config > default", async () => {
    const { mod } = await loadConfigHarness({ defaultModel: "config-model" });
    expect(mod.resolveModel("flag-model")).toBe("flag-model");
    expect(mod.resolveModel()).toBe("config-model");
  });

  it("resolveModel falls back to default when config is empty", async () => {
    const { mod } = await loadConfigHarness();
    expect(mod.resolveModel()).toBe("deepinfra/deepseek-v3.2");
  });

  it("resolveApiKey uses env first, then config", async () => {
    process.env.AI_GATEWAY_API_KEY = "env-key";
    let harness = await loadConfigHarness({ aiGatewayApiKey: "config-key" });
    expect(harness.mod.resolveApiKey()).toBe("env-key");

    delete process.env.AI_GATEWAY_API_KEY;
    harness = await loadConfigHarness({ aiGatewayApiKey: "config-key" });
    expect(harness.mod.resolveApiKey()).toBe("config-key");
  });
});

describe("saveConfig", () => {
  it("supports string shorthand for vault path", async () => {
    const { mod, fs, configFile } = await loadConfigHarness({ defaultModel: "m" });
    mod.saveConfig("/my-vault");

    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
    const [writtenPath, writtenContent] = fs.writeFileSync.mock.calls[0] as [string, string];
    expect(writtenPath).toBe(configFile);
    expect(JSON.parse(writtenContent)).toEqual({
      defaultModel: "m",
      vaultPath: "/my-vault",
    });
  });

  it("deep-merges nested config objects", async () => {
    const { mod, fs } = await loadConfigHarness({
      integrations: {
        notion: {
          databaseId: "db-1",
          auth: "$NOTION_API_TOKEN",
          defaults: { Author: "A" },
          propertyMap: [],
        },
      },
    });

    mod.saveConfig({
      integrations: {
        notion: {
          databaseId: "db-1",
          auth: "$NOTION_API_TOKEN",
          propertyMap: [
            {
              notionProperty: "Name",
              notionType: "title",
              source: "title",
            },
          ],
        },
      },
    });

    const writtenContent = (fs.writeFileSync.mock.calls[0] as [string, string])[1];
    const parsed = JSON.parse(writtenContent);

    expect(parsed.integrations.notion.databaseId).toBe("db-1");
    expect(parsed.integrations.notion.defaults).toEqual({ Author: "A" });
    expect(parsed.integrations.notion.propertyMap).toEqual([
      {
        notionProperty: "Name",
        notionType: "title",
        source: "title",
      },
    ]);
  });
});
