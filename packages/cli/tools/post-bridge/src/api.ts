import { API_BASE, getApiKey } from "./config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SocialAccount {
  id: number;
  type: string;
  name: string;
  username: string;
  platform: string;
}

export interface CreatePostPayload {
  caption: string;
  scheduled_at: string;
  social_accounts: number[];
}

export interface Post {
  id: string;
  caption: string;
  scheduled_at: string;
  status: string;
  social_accounts: SocialAccount[];
  created_at: string;
}

export interface PostResult {
  id: string;
  post_id: string;
  social_account_id: number;
  status: string;
  platform_post_url?: string;
  error_message?: string;
}

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

async function request<T>(
  method: string,
  endpoint: string,
  body?: unknown
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${endpoint} failed (${res.status}): ${text}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** List all connected social accounts */
export async function listSocialAccounts(): Promise<SocialAccount[]> {
  const data = await request<{ data: SocialAccount[] }>("GET", "/social-accounts");
  return data.data;
}

/** Create a scheduled post */
export async function createPost(payload: CreatePostPayload): Promise<Post> {
  return request<Post>("POST", "/posts", payload);
}

/** List posts, optionally filtered by status */
export async function listPosts(status?: string): Promise<Post[]> {
  const params = status ? `?status[]=${status}` : "";
  const data = await request<{ data: Post[] }>("GET", `/posts${params}`);
  return data.data;
}

/** Get a single post by ID */
export async function getPost(postId: string): Promise<Post> {
  const data = await request<{ data: Post }>("GET", `/posts/${postId}`);
  return data.data;
}

/** Update a post (must include scheduled_at) */
export async function updatePost(
  postId: string,
  payload: Partial<CreatePostPayload>
): Promise<Post> {
  const data = await request<{ data: Post }>("PATCH", `/posts/${postId}`, payload);
  return data.data;
}

/** Delete/cancel a scheduled post */
export async function deletePost(postId: string): Promise<void> {
  await request<void>("DELETE", `/posts/${postId}`);
}

/** Get publish results for a post */
export async function getPostResults(postId?: string): Promise<PostResult[]> {
  const params = postId ? `?post_id=${postId}` : "";
  const data = await request<{ data: PostResult[] }>("GET", `/post-results${params}`);
  return data.data;
}
