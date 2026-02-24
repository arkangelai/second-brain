import { describe, expect, it } from "bun:test";
const pullMod = (await import("./pull.ts" + "?pull-test")) as typeof import("./pull.ts");
const { buildMetricsSection, upsertMetricsSection } = pullMod;

describe("buildMetricsSection", () => {
  it("formats entries as markdown list", () => {
    const section = buildMetricsSection({
      Impressions: "1200",
      Engagement: "5%",
    });

    expect(section).toBe(
      "## Metrics\n\n- Impressions: 1200\n- Engagement: 5%"
    );
  });
});

describe("upsertMetricsSection", () => {
  it("returns content unchanged for empty entries", () => {
    const content = "# Post\n";
    expect(upsertMetricsSection(content, {})).toBe(content);
  });

  it("inserts metrics section when missing", () => {
    const content = "# Post\nBody";
    const next = upsertMetricsSection(content, { Impressions: "100" });
    expect(next).toContain("## Metrics");
    expect(next).toContain("- Impressions: 100");
  });

  it("replaces existing metrics section", () => {
    const content = "# Post\n## Metrics\n- Old: 1\n## Next\nBody";
    const next = upsertMetricsSection(content, { New: "2" });

    expect(next).toContain("## Metrics\n\n- New: 2");
    expect(next).not.toContain("- Old: 1");
    expect(next).toContain("## Next\nBody");
  });

  it("preserves content around inserted section", () => {
    const content = "# Post\n\n## Notes\nabc";
    const next = upsertMetricsSection(content, { Impressions: "100" });

    expect(next.startsWith("# Post")).toBe(true);
    expect(next).toContain("## Notes\nabc");
  });
});
