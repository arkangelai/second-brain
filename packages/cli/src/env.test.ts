import { describe, expect, it } from "bun:test";
import { parseCliEnv } from "./env.ts";

describe("parseCliEnv", () => {
  it("returns local mode when both remote vars are absent", () => {
    const env = parseCliEnv({});
    expect(env.mode).toBe("local");
    expect(env.remoteUrl).toBeUndefined();
    expect(env.remoteApiKey).toBeUndefined();
  });

  it("returns remote mode when both remote vars are set", () => {
    const env = parseCliEnv({
      SECOND_BRAIN_URL: "https://second-brain.example.com",
      SECOND_BRAIN_API_KEY: "k_live_abc",
    });
    expect(env.mode).toBe("remote");
    expect(env.remoteUrl).toBe("https://second-brain.example.com");
    expect(env.remoteApiKey).toBe("k_live_abc");
  });

  it("throws when only SECOND_BRAIN_URL is set", () => {
    expect(() =>
      parseCliEnv({
        SECOND_BRAIN_URL: "https://second-brain.example.com",
      })
    ).toThrow(/must be set together/);
  });

  it("throws when only SECOND_BRAIN_API_KEY is set", () => {
    expect(() =>
      parseCliEnv({
        SECOND_BRAIN_API_KEY: "k_live_abc",
      })
    ).toThrow(/must be set together/);
  });

  it("rejects an invalid SECOND_BRAIN_URL", () => {
    expect(() =>
      parseCliEnv({
        SECOND_BRAIN_URL: "not-a-url",
        SECOND_BRAIN_API_KEY: "k_live_abc",
      })
    ).toThrow(/valid URL/);
  });

  it("trims whitespace and treats blank strings as unset", () => {
    const env = parseCliEnv({
      SECOND_BRAIN_URL: "   ",
      SECOND_BRAIN_API_KEY: "   ",
    });
    expect(env.mode).toBe("local");
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

  it("lists every missing/invalid var in a single error message", () => {
    try {
      parseCliEnv({
        SECOND_BRAIN_URL: "not-a-url",
      });
      throw new Error("expected parseCliEnv to throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toContain("Invalid CLI environment variables");
      expect(message).toContain("SECOND_BRAIN_URL");
    }
  });
});
