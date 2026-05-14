import { describe, expect, it } from "bun:test";

import { scopeTemplates } from "@second-brain/shared";

import { canRead, canWrite, type PolicyPrincipal } from "./index";

const human: PolicyPrincipal = {
  kind: "human",
  id: "00000000-0000-0000-0000-000000000001",
  team_id: "00000000-0000-0000-0000-0000000000aa",
  role: "member",
};

const agent: PolicyPrincipal = {
  kind: "agent",
  id: "00000000-0000-0000-0000-000000000002",
  team_id: "00000000-0000-0000-0000-0000000000aa",
  role: "member",
  scopes: scopeTemplates.writer,
};

const frontmatter = {
  created_by: "user",
  created_at: new Date("2026-05-14T00:00:00.000Z").toISOString(),
};

describe("canWrite", () => {
  it("allows default writer agents to create notes in the notes folder", () => {
    expect(
      canWrite(agent, "create", {
        folder: "01_thinking/notes",
        slug: "new-note",
        frontmatter,
      }),
    ).toEqual({ allowed: true });
  });

  it("denies default writer agents on system paths", () => {
    const decision = canWrite(agent, "create", {
      folder: "06_system",
      slug: "x",
      frontmatter,
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("path_not_allowed");
  });

  it("denies direct agent edits to MOC bodies with append guidance", () => {
    const decision = canWrite(agent, "edit", {
      folder: "01_thinking",
      slug: "leadership",
      frontmatter,
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe("locked_path");
      expect(decision.hint).toBe("Use append op instead");
    }
  });

  it("lets human members edit regular notes but never hard-delete", () => {
    expect(
      canWrite(human, "edit", {
        folder: "01_thinking",
        slug: "leadership",
        frontmatter,
      }),
    ).toEqual({ allowed: true });

    const decision = canWrite(human, "delete", {
      folder: "01_thinking/notes",
      slug: "x",
      frontmatter,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("delete_forbidden");
  });

  it("rejects frontmatter missing created_by at the policy layer", () => {
    const decision = canWrite(human, "create", {
      folder: "01_thinking/notes",
      slug: "x",
      frontmatter: {
        created_at: frontmatter.created_at,
      },
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("frontmatter_invalid");
  });

  it("rejects unknown frontmatter keys", () => {
    const decision = canWrite(human, "create", {
      folder: "01_thinking/notes",
      slug: "x",
      frontmatter: {
        ...frontmatter,
        mood: "speculative",
      },
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toContain("Unknown frontmatter key");
  });
});

describe("canRead", () => {
  it("allows human members to read regular notes", () => {
    expect(
      canRead(human, "get", {
        folder: "06_system/private",
        slug: "strategy",
      }),
    ).toEqual({ allowed: true });
  });

  it("denies agent reads outside read_paths", () => {
    const scopedAgent: PolicyPrincipal = {
      ...agent,
      scopes: {
        ...scopeTemplates.reader,
        read_paths: ["01_thinking/notes/**"],
      },
    };

    const decision = canRead(scopedAgent, "get", {
      folder: "06_system/private",
      slug: "strategy",
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("path_not_allowed");
  });

  it("denies agent search when get/search ops are missing", () => {
    const scopedAgent: PolicyPrincipal = {
      ...agent,
      scopes: {
        ...scopeTemplates.reader,
        ops: [],
      },
    };

    const decision = canRead(scopedAgent, "search", {
      folder: "01_thinking/notes",
      slug: "strategy",
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("op_not_allowed");
  });
});
