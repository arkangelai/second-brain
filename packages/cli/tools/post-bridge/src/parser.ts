import fs from "fs";
import path from "path";
import { PIPELINE_SUBDIRS, SKIP_FILES } from "./config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelinePost {
  filename: string;
  title: string;
  status: string;
  pillar: string;
  platform: string;
  structure: string;
  publishDate: string;
  publishedUrl: string;
  draftX: string;
  draftLinkedIn: string;
}

// ---------------------------------------------------------------------------
// Resolve a filename to its full path across pipeline subdirectories
// ---------------------------------------------------------------------------

export function resolveFilePath(filename: string, pipelineDir: string): string {
  // Try each subdirectory
  for (const subdir of PIPELINE_SUBDIRS) {
    const candidate = path.join(pipelineDir, subdir, filename);
    if (fs.existsSync(candidate)) return candidate;
  }
  // Fall back to pipeline root
  const rootCandidate = path.join(pipelineDir, filename);
  if (fs.existsSync(rootCandidate)) return rootCandidate;
  throw new Error(`File not found: ${filename} (searched ${PIPELINE_SUBDIRS.join(", ")} and root)`);
}

// ---------------------------------------------------------------------------
// Parse a single pipeline markdown file
// ---------------------------------------------------------------------------

export function parseFile(filename: string, pipelineDir: string): PipelinePost {
  const fullPath = resolveFilePath(filename, pipelineDir);
  const content = fs.readFileSync(fullPath, "utf-8");
  return parseMarkdown(content, filename);
}

export function parseMarkdown(content: string, filename: string): PipelinePost {
  const post: PipelinePost = {
    filename,
    title: "",
    status: "",
    pillar: "",
    platform: "",
    structure: "",
    publishDate: "",
    publishedUrl: "",
    draftX: "",
    draftLinkedIn: "",
  };

  // Title from "# Post: Title"
  const titleMatch = content.match(/^#\s+Post:\s*(.+)$/m);
  if (titleMatch) {
    post.title = titleMatch[1].trim();
  } else {
    const h1Match = content.match(/^#\s+(.+)$/m);
    post.title = h1Match ? h1Match[1].trim() : filename.replace(/\.md$/, "");
  }

  // Metadata fields
  post.status = extractMetaField(content, "Status");
  post.pillar = extractMetaField(content, "Pillar");
  post.platform = extractMetaField(content, "Platform");
  post.structure = extractMetaField(content, "Structure");
  post.publishDate = extractMetaField(content, "Publish date").replace(/^-+$/, "");
  post.publishedUrl = extractMetaField(content, "Published URL").replace(/^-+$/, "");

  // Draft sections
  const sections = splitSections(content);
  const draftSection = sections["Draft"] ?? "";
  const subSections = splitSubSections(draftSection);
  post.draftX = extractCodeBlock(subSections["X Version"] ?? "");
  post.draftLinkedIn = extractCodeBlock(subSections["LinkedIn Version"] ?? "");

  return post;
}

// ---------------------------------------------------------------------------
// Scan pipeline directory for posts
// ---------------------------------------------------------------------------

export function scanReadyPosts(pipelineDir: string): PipelinePost[] {
  return scanPosts(pipelineDir).filter((p) => p.status === "ready");
}

export function scanPosts(pipelineDir: string): PipelinePost[] {
  const posts: PipelinePost[] = [];

  for (const subdir of PIPELINE_SUBDIRS) {
    const dir = path.join(pipelineDir, subdir);
    if (!fs.existsSync(dir)) continue;

    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      if (SKIP_FILES.includes(entry)) continue;

      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;

      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        const post = parseMarkdown(content, entry);
        posts.push(post);
      } catch {
        // Skip files that fail to parse
      }
    }
  }

  return posts;
}

// ---------------------------------------------------------------------------
// Update a pipeline file's Publish date field in-place
// ---------------------------------------------------------------------------

export function updatePublishDate(filename: string, date: string, pipelineDir: string): void {
  const fullPath = resolveFilePath(filename, pipelineDir);
  let content = fs.readFileSync(fullPath, "utf-8");

  // Replace the Publish date field value using regex (avoid matching newlines)
  const re = /(-\s+\*\*Publish date:\*\*[^\S\n]*).*/;
  if (re.test(content)) {
    content = content.replace(re, `$1${date}`);
  }

  fs.writeFileSync(fullPath, content);
}

/** Update the status field of a pipeline file */
export function updateStatus(filename: string, status: string, pipelineDir: string): void {
  const fullPath = resolveFilePath(filename, pipelineDir);
  let content = fs.readFileSync(fullPath, "utf-8");

  const re = /(-\s+\*\*Status:\*\*\s*).*/;
  if (re.test(content)) {
    content = content.replace(re, `$1${status}`);
  }

  fs.writeFileSync(fullPath, content);
}

// ---------------------------------------------------------------------------
// Helpers (adapted from sync project parser)
// ---------------------------------------------------------------------------

function extractMetaField(text: string, field: string): string {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Use [^\S\n]* instead of \s* to avoid matching across newlines
  const re = new RegExp(`-\\s+\\*\\*${escaped}:\\*\\*[^\\S\\n]*(.*)`, "i");
  const m = text.match(re);
  if (!m) return "";
  return m[1].replace(/<!--.*?-->/g, "").trim();
}

function splitSections(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = content.split(/^## /m);
  for (const part of parts.slice(1)) {
    const newlineIdx = part.indexOf("\n");
    if (newlineIdx === -1) continue;
    const name = part.slice(0, newlineIdx).trim();
    const body = part.slice(newlineIdx + 1);
    result[name] = body;
  }
  return result;
}

function splitSubSections(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = content.split(/^### /m);
  for (const part of parts.slice(1)) {
    const newlineIdx = part.indexOf("\n");
    if (newlineIdx === -1) continue;
    const name = part.slice(0, newlineIdx).trim();
    const body = part.slice(newlineIdx + 1);
    result[name] = body;
  }
  return result;
}

function extractCodeBlock(text: string): string {
  const m = text.match(/```\n?([\s\S]*?)```/);
  if (m) return m[1].trim();
  return text.trim();
}
