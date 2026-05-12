import { getPostResults } from "../api.js";

export async function resultsCommand(args: string[]): Promise<void> {
  let postId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--post-id" && args[i + 1]) {
      postId = args[++i];
    }
  }

  console.log(`Fetching publish results${postId ? ` for post ${postId}` : ""}...\n`);

  const results = await getPostResults(postId);

  if (results.length === 0) {
    console.log("No results found.");
    return;
  }

  console.log("  Post ID       Account ID  Status      URL");
  console.log("  " + "─".repeat(70));

  for (const r of results) {
    const pid = r.post_id.slice(0, 12);
    const url = r.platform_post_url || r.error_message || "—";
    console.log(`  ${pid.padEnd(14)}${String(r.social_account_id).padEnd(12)}${r.status.padEnd(12)}${url}`);
  }

  console.log(`\n${results.length} result(s) total.`);
}
