import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { log, success, error, bold, dim, slugify } from "../utils.ts";
import { resolveVaultPath } from "../config.ts";

const NOTE_TEMPLATE = (title: string) => `# ${title}

_One paragraph stating the core insight._

---

## Context

_Where did this idea come from? What triggered it?_

## The Idea

_Develop the claim. Why is this true? What's the evidence?_

## Connections

_How does this relate to other notes? Use [[wiki links]] inline._

## Open Threads

_What questions does this raise? What's worth exploring next?_
`;

const POST_TEMPLATE = (title: string) => `# ${title}

**Status:** idea
**Platform:**
**Pillar:**
**Structure:**
**Source notes:**

---

## Core Idea

_What's the one thing you want the reader to take away?_

## Draft

_Write the post here._

## Notes

_Any context, alternatives, or revisions to track._
`;

type NoteType = "note" | "post";

const TYPE_CONFIG: Record<NoteType, { dir: string; template: (t: string) => string }> = {
  note: { dir: "01_thinking/notes", template: NOTE_TEMPLATE },
  post: { dir: "03_creating/pipeline", template: POST_TEMPLATE },
};

export function create(
  type: string | undefined,
  title: string | undefined,
  vaultFlag?: string
): void {
  if (!type || !["note", "post"].includes(type)) {
    error(`Invalid type: ${type || "(none)"}`);
    log(`Usage: ${dim("second-brain create note \"title\"")}`);
    log(`       ${dim("second-brain create post \"title\"")}`);
    process.exit(1);
  }

  if (!title) {
    error("Missing title.");
    log(`Usage: ${dim(`second-brain create ${type} "your title"`)}`);
    process.exit(1);
  }

  const vaultPath = resolveVaultPath(vaultFlag);
  const config = TYPE_CONFIG[type as NoteType];
  const slug = slugify(title);
  const filename = `${slug}.md`;
  const dir = join(vaultPath, config.dir);
  const filePath = join(dir, filename);

  if (existsSync(filePath)) {
    error(`File already exists: ${filePath}`);
    process.exit(1);
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, config.template(title));

  console.log();
  success(`Created ${type}: ${bold(filename)}`);
  log(`  ${dim(filePath)}`);
  console.log();
}
