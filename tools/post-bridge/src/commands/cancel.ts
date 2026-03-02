import { deletePost, getPost } from "../api.js";

export async function cancelCommand(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error("Usage: bun run cancel -- <post-id>");
    process.exit(1);
  }

  const postId = args[0];

  // Fetch post details first for confirmation
  try {
    const post = await getPost(postId);
    console.log(`Cancelling post: "${post.caption.slice(0, 60).replace(/\n/g, " ")}..."`);
    console.log(`  Status:    ${post.status}`);
    console.log(`  Scheduled: ${post.scheduled_at}`);
  } catch {
    // Post might still be deletable even if GET fails
  }

  await deletePost(postId);
  console.log(`\nPost ${postId} cancelled/deleted.`);
}
