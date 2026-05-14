import { describe, expect, it } from "bun:test";

import {
  AGENT_KEY_SECRET_LENGTH,
  generateKey,
  hashKey,
  parseAgentKey,
  verifyKey,
} from "./agentKeys";

describe("agentKeys", () => {
  it("generates sb_live keys with a team slug and base64url secret", () => {
    const key = generateKey("Dev-Team");
    const parsed = parseAgentKey(key.plaintext);

    expect(key.plaintext).toMatch(
      new RegExp(`^sb_live_dev-team_[A-Za-z0-9_-]{${AGENT_KEY_SECRET_LENGTH}}$`),
    );
    expect(key.prefix).toMatch(/^sb_live_dev-team_[A-Za-z0-9_-]{8}$/);
    expect(parsed?.teamSlug).toBe("dev-team");
    expect(parsed?.prefix).toBe(key.prefix);
  });

  it("hashes with argon2id and verifies only the original plaintext", async () => {
    const { plaintext } = generateKey("dev");
    const hash = await hashKey(plaintext);

    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyKey(plaintext, hash)).toBe(true);
    expect(await verifyKey(`${plaintext}x`, hash)).toBe(false);
  });

  it("rejects malformed keys", () => {
    expect(parseAgentKey("sb_live_dev_not-long-enough")).toBeNull();
    expect(() => generateKey("bad_slug")).toThrow();
  });
});
