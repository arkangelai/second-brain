import { getPipelineDir } from "../config.js";
import { parseFile } from "../parser.js";

export async function previewCommand(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error("Usage: bun run preview -- <filename.md>");
    process.exit(1);
  }

  const pipelineDir = getPipelineDir();
  const filename = args[0];
  const post = parseFile(filename, pipelineDir);

  console.log(`\nPreview: ${post.title}`);
  console.log("═".repeat(60));
  console.log(`  Status:    ${post.status}`);
  console.log(`  Platform:  ${post.platform}`);
  console.log(`  Structure: ${post.structure}`);
  console.log(`  Pillar:    ${post.pillar}`);
  console.log(`  Pub date:  ${post.publishDate || "(not set)"}`);
  console.log();

  if (post.platform === "x" || post.platform === "both") {
    console.log("── X Version ──────────────────────────────────────");
    console.log(post.draftX || "(empty)");
    console.log(`  [${post.draftX.length} chars]`);
    console.log();
  }

  if (post.platform === "linkedin" || post.platform === "both") {
    console.log("── LinkedIn Version ────────────────────────────────");
    console.log(post.draftLinkedIn || "(empty)");
    console.log(`  [${post.draftLinkedIn.length} chars]`);
    console.log();
  }

  // Validation warnings
  const warnings: string[] = [];
  if (post.status !== "ready") warnings.push(`Status is "${post.status}", not "ready"`);
  if (!post.draftX && (post.platform === "x" || post.platform === "both")) {
    warnings.push("X version is empty");
  }
  if (!post.draftLinkedIn && (post.platform === "linkedin" || post.platform === "both")) {
    warnings.push("LinkedIn version is empty");
  }

  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const w of warnings) console.log(`  ! ${w}`);
  }
}
