import { listPosts } from "../api.js";

export async function listCommand(args: string[]): Promise<void> {
  let status: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--status" && args[i + 1]) {
      status = args[++i];
    }
  }

  console.log(`Fetching posts${status ? ` (status: ${status})` : ""}...\n`);

  const posts = await listPosts(status);

  if (posts.length === 0) {
    console.log("No posts found.");
    return;
  }

  console.log("  ID            Status      Scheduled At          Caption");
  console.log("  " + "─".repeat(76));

  for (const post of posts) {
    const id = post.id.slice(0, 12);
    const stat = post.status.padEnd(10);
    const scheduled = post.scheduled_at ? post.scheduled_at.slice(0, 19).replace("T", " ") : "(none)".padEnd(19);
    const caption = post.caption.slice(0, 40).replace(/\n/g, " ");
    console.log(`  ${id.padEnd(14)}${stat}  ${scheduled}  ${caption}...`);
  }

  console.log(`\n${posts.length} post(s) total.`);
}
