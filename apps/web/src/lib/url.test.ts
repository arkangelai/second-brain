import { describe, expect, it } from "bun:test";

process.env.SKIP_ENV_VALIDATION = "1";

const { localRequestOrigin, safeRedirectPath } = await import("./url");

describe("localRequestOrigin", () => {
  it("uses localhost host and port from the request", () => {
    expect(
      localRequestOrigin(headerReader({ host: "localhost:3007" }))
    ).toBe("http://localhost:3007");
  });

  it("preserves local https forwarded protocol", () => {
    expect(
      localRequestOrigin(
        headerReader({
          host: "127.0.0.1:3000",
          "x-forwarded-proto": "https",
        })
      )
    ).toBe("https://127.0.0.1:3000");
  });

  it("does not override APP_URL for non-local hosts", () => {
    expect(localRequestOrigin(headerReader({ host: "vrain.org" }))).toBeNull();
  });
});

describe("safeRedirectPath", () => {
  it("accepts internal paths only", () => {
    expect(safeRedirectPath("/admin/team")).toBe("/admin/team");
    expect(safeRedirectPath("https://example.com")).toBe("/");
    expect(safeRedirectPath("//example.com")).toBe("/");
  });
});

function headerReader(values: Record<string, string>) {
  const normalized = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value])
  );

  return {
    get(name: string): string | null {
      return normalized.get(name.toLowerCase()) ?? null;
    },
  };
}
