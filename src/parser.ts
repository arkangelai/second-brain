export interface ParsedPost {
  title: string;
  metadata: Record<string, string>;
  sections: Record<string, string>;
  rawContent: string;
}

const METADATA_LINE = /^\*\*([^*]+):\*\*\s*(.*)$/;
const H1_LINE = /^#\s+(.+)$/;
const H2_LINE = /^##\s+(.+)$/;

export function parsePipelinePost(content: string): ParsedPost {
  const lines = content.split(/\r?\n/);

  let title = "Untitled";
  for (const line of lines) {
    const match = line.match(H1_LINE);
    if (match) {
      title = match[1].trim();
      break;
    }
  }

  const metadata: Record<string, string> = {};
  const dividerIndex = lines.findIndex((line) => line.trim() === "---");

  if (dividerIndex !== -1) {
    for (let i = 0; i < dividerIndex; i++) {
      const match = lines[i].match(METADATA_LINE);
      if (!match) continue;
      const key = match[1].trim();
      const value = match[2].trim();
      metadata[key] = value;
    }
  }

  const body = dividerIndex === -1 ? content : lines.slice(dividerIndex + 1).join("\n");
  const sections = parseSections(body);

  return {
    title,
    metadata,
    sections,
    rawContent: content,
  };
}

function parseSections(content: string): Record<string, string> {
  const lines = content.split(/\r?\n/);
  const sections: Record<string, string> = {};

  let currentHeading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentHeading) return;
    sections[currentHeading] = buffer.join("\n").trim();
    buffer = [];
  };

  for (const line of lines) {
    const match = line.match(H2_LINE);
    if (match) {
      flush();
      currentHeading = match[1].trim();
      continue;
    }

    if (currentHeading) {
      buffer.push(line);
    }
  }

  flush();
  return sections;
}

export function updatePostMetadata(content: string, updates: Record<string, string>): string {
  if (Object.keys(updates).length === 0) return content;

  const lines = content.split(/\r?\n/);
  const dividerIndex = lines.findIndex((line) => line.trim() === "---");

  if (dividerIndex === -1) {
    return content;
  }

  const seen = new Set<string>();

  for (let i = 0; i < dividerIndex; i++) {
    const match = lines[i].match(METADATA_LINE);
    if (!match) continue;

    const key = match[1].trim();
    if (!(key in updates)) continue;

    lines[i] = `**${key}:** ${updates[key]}`;
    seen.add(key);
  }

  const missingEntries = Object.entries(updates).filter(([key]) => !seen.has(key));
  if (missingEntries.length > 0) {
    const toInsert = missingEntries.map(([key, value]) => `**${key}:** ${value}`);
    lines.splice(dividerIndex, 0, ...toInsert);
  }

  const rebuilt = lines.join("\n");
  return content.endsWith("\n") ? `${rebuilt}\n` : rebuilt;
}
