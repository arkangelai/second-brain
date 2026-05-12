import { describe, expect, it } from "bun:test";
import { parseCliEnv } from "./env.ts";

describe("parseCliEnv", () => {
  it("returns local mode", () => {
    const env = parseCliEnv({});
    expect(env.mode).toBe("local");
  });

  it("trims whitespace and treats blank strings as unset", () => {
    const env = parseCliEnv({
      SECOND_BRAIN_PATH: "   ",
      AI_GATEWAY_API_KEY: "   ",
    });
    expect(env.mode).toBe("local");
    expect(env.vaultPath).toBeUndefined();
    expect(env.aiGatewayApiKey).toBeUndefined();
  });

  it("passes through optional vault path and AI gateway key", () => {
    const env = parseCliEnv({
      SECOND_BRAIN_PATH: "/custom/vault",
      AI_GATEWAY_API_KEY: "gw_abc",
    });
    expect(env.mode).toBe("local");
    expect(env.vaultPath).toBe("/custom/vault");
    expect(env.aiGatewayApiKey).toBe("gw_abc");
  });
});
