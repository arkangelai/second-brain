export const DEFAULT_APPEND_SECTIONS = [
  "breadcrumbs",
  "open_questions",
  "key_notes",
  "sources",
] as const;

export function slugifyTitle(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "untitled";
}

export function normalizeFolder(folder: string | undefined): string {
  const normalized = normalizePath(folder || "00_inbox");
  return normalized || "00_inbox";
}

export function normalizeSlug(slug: string): string {
  return slugifyTitle(slug.replace(/\.md$/i, ""));
}

export function notePath(folder: string, slug: string): string {
  return `${normalizeFolder(folder)}/${normalizeSlug(slug)}.md`;
}

export function extractWikiLinks(body: string): string[] {
  const links = new Set<string>();
  let inFence = false;

  for (const line of body.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const pattern = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line))) {
      const slug = match[1]?.trim();
      if (slug) links.add(slug);
    }
  }

  return [...links];
}

export function insertWikiLink(
  body: string,
  targetSlug: string,
  contextPhrase?: string,
): { body: string; changed: boolean } {
  const normalizedTarget = normalizeSlug(targetSlug);
  if (hasWikiLink(body, normalizedTarget)) {
    return { body, changed: false };
  }

  if (contextPhrase) {
    const withContext = insertNearContextPhrase(body, normalizedTarget, contextPhrase);
    if (withContext.changed) return withContext;
  }

  return insertUnderRelated(body, normalizedTarget);
}

export function allowedAppendSections(frontmatter: {
  append_sections?: unknown;
}): string[] {
  if (
    Array.isArray(frontmatter.append_sections) &&
    frontmatter.append_sections.every((section) => typeof section === "string")
  ) {
    return [...new Set([...DEFAULT_APPEND_SECTIONS, ...frontmatter.append_sections])];
  }

  return [...DEFAULT_APPEND_SECTIONS];
}

function hasWikiLink(body: string, targetSlug: string): boolean {
  return extractWikiLinks(body).some((slug) => normalizeSlug(slug) === targetSlug);
}

function insertNearContextPhrase(
  body: string,
  targetSlug: string,
  contextPhrase: string,
): { body: string; changed: boolean } {
  const lines = body.split("\n");
  let inFence = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const phraseIndex = line.indexOf(contextPhrase);
    if (phraseIndex === -1 || isInsideMarkdownLink(line, phraseIndex)) continue;

    const insertAt = phraseIndex + contextPhrase.length;
    lines[lineIndex] =
      line.slice(0, insertAt) + ` [[${targetSlug}]]` + line.slice(insertAt);
    return { body: lines.join("\n"), changed: true };
  }

  return { body, changed: false };
}

function insertUnderRelated(
  body: string,
  targetSlug: string,
): { body: string; changed: boolean } {
  const lines = body.split("\n");
  const relatedIndex = lines.findIndex((line) => /^##\s+Related\s*$/i.test(line));
  const entry = `- [[${targetSlug}]]`;

  if (relatedIndex === -1) {
    const separator = body.trim() ? "\n\n" : "";
    return {
      body: `${body}${separator}## Related\n${entry}`,
      changed: true,
    };
  }

  let insertAt = lines.length;
  for (let index = relatedIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index] ?? "")) {
      insertAt = index;
      break;
    }
  }

  lines.splice(insertAt, 0, entry);
  return { body: lines.join("\n"), changed: true };
}

function isInsideMarkdownLink(line: string, index: number): boolean {
  const open = line.lastIndexOf("[", index);
  const close = line.indexOf(")", index);
  if (open === -1 || close === -1) return false;

  const linkMiddle = line.indexOf("](", open);
  return linkMiddle !== -1 && linkMiddle < index && index < close;
}

function normalizePath(path: string): string {
  const normalized: string[] = [];

  for (const segment of path.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;

    if (segment === "..") {
      if (normalized.length === 0) return "";
      normalized.pop();
      continue;
    }

    normalized.push(segment);
  }

  return normalized.join("/");
}
