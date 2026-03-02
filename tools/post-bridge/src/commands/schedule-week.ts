import { createPost } from "../api.js";
import type { CreatePostPayload } from "../api.js";
import { requireConfig, getPipelineDir, DEFAULT_POSTING_TIME, UTC_OFFSET } from "../config.js";
import { scanReadyPosts, parseFile, updatePublishDate } from "../parser.js";

interface ScheduleResult {
  filename: string;
  title: string;
  date: string;
  xPostId?: string;
  linkedInPostId?: string;
}

export async function scheduleWeekCommand(args: string[]): Promise<void> {
  const config = requireConfig();
  const pipelineDir = getPipelineDir();

  // Parse args: [--start YYYY-MM-DD] [file1.md file2.md ...]
  let startDate = "";
  const specificFiles: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start" && args[i + 1]) {
      startDate = args[++i];
    } else if (args[i].endsWith(".md")) {
      specificFiles.push(args[i]);
    }
  }

  // Get posts to schedule
  let posts;
  if (specificFiles.length > 0) {
    posts = specificFiles.map((f) => parseFile(f, pipelineDir));
  } else {
    posts = scanReadyPosts(pipelineDir);
  }

  if (posts.length === 0) {
    console.log("No posts with status 'ready' found.");
    return;
  }

  // Determine start date: --start value, or next weekday from today
  let current: Date;
  if (startDate) {
    current = new Date(startDate + "T00:00:00");
  } else {
    current = getNextWeekday(new Date());
  }

  console.log(`\nScheduling ${posts.length} post(s) starting ${formatDate(current)}:\n`);

  const results: ScheduleResult[] = [];

  for (const post of posts) {
    // Skip to next weekday if current is weekend
    current = ensureWeekday(current);
    const date = formatDate(current);
    const scheduledAt = `${date}T${DEFAULT_POSTING_TIME}:00${UTC_OFFSET}`;

    const result: ScheduleResult = { filename: post.filename, title: post.title, date };
    let scheduled = false;

    // Schedule X post separately
    if (post.platform === "x" || post.platform === "both") {
      if (!config.accounts.twitter) {
        console.log(`  SKIP  ${post.filename} X — no Twitter account configured`);
      } else {
        const caption = post.draftX || post.draftLinkedIn;
        if (!caption) {
          console.log(`  SKIP  ${post.filename} X — no draft content`);
        } else {
          try {
            const payload: CreatePostPayload = {
              caption,
              scheduled_at: scheduledAt,
              social_accounts: [config.accounts.twitter.id],
            };
            const res = await createPost(payload);
            result.xPostId = res.id;
            scheduled = true;
            console.log(`  OK    ${date}  X         ${post.title}`);
          } catch (err) {
            console.error(`  FAIL  ${post.filename} X: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    }

    // Schedule LinkedIn post separately
    if (post.platform === "linkedin" || post.platform === "both") {
      if (!config.accounts.linkedin) {
        console.log(`  SKIP  ${post.filename} LinkedIn — no LinkedIn account configured`);
      } else {
        const caption = post.draftLinkedIn || post.draftX;
        if (!caption) {
          console.log(`  SKIP  ${post.filename} LinkedIn — no draft content`);
        } else {
          try {
            const payload: CreatePostPayload = {
              caption,
              scheduled_at: scheduledAt,
              social_accounts: [config.accounts.linkedin.id],
            };
            const res = await createPost(payload);
            result.linkedInPostId = res.id;
            scheduled = true;
            console.log(`  OK    ${date}  LinkedIn  ${post.title}`);
          } catch (err) {
            console.error(`  FAIL  ${post.filename} LinkedIn: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    }

    if (scheduled) {
      updatePublishDate(post.filename, date, pipelineDir);
      results.push(result);
    }

    // Advance to next day
    current = addDays(current, 1);
  }

  // Summary
  console.log("\n" + "─".repeat(70));
  console.log(`Scheduled ${results.length}/${posts.length} posts:\n`);
  console.log("  Date        Platform   Post ID       Title");
  console.log("  " + "─".repeat(66));
  for (const r of results) {
    if (r.xPostId) {
      const id = r.xPostId.slice(0, 12);
      console.log(`  ${r.date}  X          ${id.padEnd(14)}${r.title}`);
    }
    if (r.linkedInPostId) {
      const id = r.linkedInPostId.slice(0, 12);
      console.log(`  ${r.date}  LinkedIn   ${id.padEnd(14)}${r.title}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function getNextWeekday(from: Date): Date {
  const d = new Date(from);
  // Start from tomorrow if today
  d.setDate(d.getDate() + 1);
  return ensureWeekday(d);
}

function ensureWeekday(d: Date): Date {
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() + 1); // Sunday → Monday
  if (day === 6) d.setDate(d.getDate() + 2); // Saturday → Monday
  return d;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
