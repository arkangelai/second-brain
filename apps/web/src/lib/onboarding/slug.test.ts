import { describe, expect, it } from "bun:test";

import { normalizeTeamSlug } from "./slug";

describe("normalizeTeamSlug", () => {
  it("lowercases and kebab-cases team slugs", () => {
    expect(normalizeTeamSlug(" Jose's Brain HQ ")).toBe("jose-s-brain-hq");
  });

  it("collapses punctuation and trims separators", () => {
    expect(normalizeTeamSlug("...Second___Brain!!!")).toBe("second-brain");
  });

  it("falls back to team when the input has no slug characters", () => {
    expect(normalizeTeamSlug("!!!")).toBe("team");
  });
});
