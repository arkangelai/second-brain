import { createPost } from "../api.js";
import type { CreatePostPayload } from "../api.js";
import { requireConfig, getPipelineDir, DEFAULT_POSTING_TIME, UTC_OFFSET } from "../config.js";
import { parseFile, updatePublishDate } from "../parser.js";

export async function scheduleCommand(args: string[]): Promise<void> {
  // Parse args: <filename> --date YYYY-MM-DD [--time HH:MM]
  if (args.length < 1) {
    console.error("Usage: bun run schedule -- <filename.md> --date YYYY-MM-DD [--time HH:MM]");
    process.exit(1);
  }

  const filename = args[0];
  let date = "";
  let time = DEFAULT_POSTING_TIME;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--date" && args[i + 1]) {
      date = args[++i];
    } else if (args[i] === "--time" && args[i + 1]) {
      time = args[++i];
    }
  }

  if (!date) {
    console.error("Error: --date YYYY-MM-DD is required.");
    process.exit(1);
  }

  const config = requireConfig();
  const pipelineDir = getPipelineDir();
  const post = parseFile(filename, pipelineDir);

  if (!post.draftX && !post.draftLinkedIn) {
    console.error(`Error: ${filename} has no draft content.`);
    process.exit(1);
  }

  // Build scheduled_at in ISO 8601 with timezone offset
  const scheduledAt = `${date}T${time}:00${UTC_OFFSET}`;

  console.log(`Scheduling "${post.title}" for ${date} at ${time} COT...`);

  const postIds: string[] = [];

  // Schedule X post (separate API call with X-specific content)
  if (post.platform === "x" || post.platform === "both") {
    if (!config.accounts.twitter) {
      console.error("Error: No Twitter account configured. Run `bun run accounts` first.");
      process.exit(1);
    }
    const caption = post.draftX || post.draftLinkedIn;
    const payload: CreatePostPayload = {
      caption,
      scheduled_at: scheduledAt,
      social_accounts: [config.accounts.twitter.id],
    };
    const result = await createPost(payload);
    postIds.push(result.id);
    console.log(`  X:        ${result.id} → @${config.accounts.twitter.username}`);
  }

  // Schedule LinkedIn post (separate API call with LinkedIn-specific content)
  if (post.platform === "linkedin" || post.platform === "both") {
    if (!config.accounts.linkedin) {
      console.error("Error: No LinkedIn account configured. Run `bun run accounts` first.");
      process.exit(1);
    }
    const caption = post.draftLinkedIn || post.draftX;
    const payload: CreatePostPayload = {
      caption,
      scheduled_at: scheduledAt,
      social_accounts: [config.accounts.linkedin.id],
    };
    const result = await createPost(payload);
    postIds.push(result.id);
    console.log(`  LinkedIn: ${result.id} → @${config.accounts.linkedin.username}`);
  }

  // Update the pipeline file's publish date
  updatePublishDate(filename, date, pipelineDir);

  console.log(`\nScheduled successfully!`);
  console.log(`  Post IDs:     ${postIds.join(", ")}`);
  console.log(`  Scheduled at: ${scheduledAt}`);
  console.log(`  File updated: ${filename} → Publish date: ${date}`);
}
