import { describe, expect, test } from "bun:test";

import { getBearerToken, parseAgentApiKey } from "./api-key";

describe("getBearerToken", () => {
  test("returns a single bearer token", () => {
    expect(getBearerToken("Bearer sb_live_demo_key123_secret")).toBe(
      "sb_live_demo_key123_secret"
    );
  });

  test("rejects missing or ambiguous authorization values", () => {
    expect(getBearerToken(null)).toBeNull();
    expect(getBearerToken("Basic abc")).toBeNull();
    expect(getBearerToken("Bearer one two")).toBeNull();
  });
});

describe("parseAgentApiKey", () => {
  test("parses the team slug hint and secret", () => {
    expect(parseAgentApiKey("sb_live_acme_key123_abc123")).toEqual({
      teamSlug: "acme",
      keyPrefix: "key123",
      secret: "abc123",
    });
  });

  test("does not require a fixed secret length before verification", () => {
    expect(parseAgentApiKey("sb_live_acme_key123_short")).toEqual({
      teamSlug: "acme",
      keyPrefix: "key123",
      secret: "short",
    });
  });

  test("parses team slug hints containing underscores", () => {
    expect(parseAgentApiKey("sb_live_acme_research_key123_secret")).toEqual({
      teamSlug: "acme_research",
      keyPrefix: "key123",
      secret: "secret",
    });
  });

  test("rejects malformed keys", () => {
    expect(parseAgentApiKey("sb_test_acme_secret")).toBeNull();
    expect(parseAgentApiKey("sb_live__secret")).toBeNull();
    expect(parseAgentApiKey("sb_live_acme_")).toBeNull();
    expect(parseAgentApiKey("sb_live_acme__secret")).toBeNull();
    expect(parseAgentApiKey("sb_live_acme_key123_")).toBeNull();
  });
});
