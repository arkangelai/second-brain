import { randomBytes, randomUUID, scrypt, type ScryptOptions } from "node:crypto";

import { AgentScopesSchema, scopeTemplates, type AgentScopes } from "@second-brain/shared";

const DEV_TEAM_ID = "00000000-0000-0000-0000-0000000000a1";
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

export type AdminRole = "owner" | "admin" | "member";

export type AgentSummary = {
  id: string;
  name: string;
  description: string;
  status: "active" | "revoked";
  scopes: AgentScopes;
  lastSeen: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type AdminAgentsContext = {
  teamId: string;
  teamSlug: string;
  actorUserId: string | null;
  role: AdminRole;
  canManage: boolean;
};

type AgentRecord = AgentSummary & {
  teamId: string;
};

type SupabaseAgentRow = {
  member_id: string;
  display_name: string;
  description: string | null;
  scopes: unknown;
  created_by_user_id: string | null;
  last_seen_at: string | null;
  active: boolean;
  revoked_at: string | null;
  joined_at: string;
};

type SupabaseTeamRow = {
  slug: string;
};

type GeneratedAgentKey = {
  plaintextKey: string;
  keyPrefix: string;
};

type GlobalAgentStore = typeof globalThis & {
  __secondBrainAdminAgents?: AgentRecord[];
};

export function getAdminAgentsContext(request: Request): AdminAgentsContext {
  assertLocalAdminRoute();

  const role = parseRole(
    request.headers.get("x-second-brain-role") ??
      process.env.SECOND_BRAIN_DEV_ROLE
  );
  const teamId =
    request.headers.get("x-second-brain-team-id") ??
    process.env.SECOND_BRAIN_DEV_TEAM_ID ??
    DEV_TEAM_ID;
  const teamSlug =
    request.headers.get("x-second-brain-team-slug") ??
    process.env.SECOND_BRAIN_DEV_TEAM_SLUG ??
    "dev";
  const actorUserId =
    request.headers.get("x-second-brain-user-id") ??
    process.env.SECOND_BRAIN_DEV_USER_ID ??
    (hasSupabaseConfig() ? null : DEV_USER_ID);

  return {
    teamId,
    teamSlug,
    actorUserId,
    role,
    canManage: role === "owner" || role === "admin",
  };
}

export async function listAgents(
  context: AdminAgentsContext
): Promise<AgentSummary[]> {
  if (!hasSupabaseConfig()) {
    return getMemoryStore()
      .filter((agent) => agent.teamId === context.teamId)
      .map(stripTeamId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const url = supabaseRestUrl("/team_members");
  url.searchParams.set("team_id", `eq.${context.teamId}`);
  url.searchParams.set("member_type", "eq.agent");
  url.searchParams.set(
    "select",
    "member_id,display_name,description,scopes,created_by_user_id,last_seen_at,active,revoked_at,joined_at"
  );
  url.searchParams.set("order", "joined_at.desc");

  const rows = await supabaseFetch<SupabaseAgentRow[]>(url);
  return rows.map(agentFromSupabaseRow);
}

export async function createAgent(
  context: AdminAgentsContext,
  input: { name: string; description: string; scopes: unknown }
): Promise<{ agent: AgentSummary; plaintextKey: string }> {
  assertCanManage(context);

  const name = input.name.trim();
  if (name.length < 2) {
    throw new RequestError(400, "Agent name must be at least 2 characters.");
  }

  const parsedScopes = AgentScopesSchema.safeParse(input.scopes);
  if (!parsedScopes.success) {
    throw new RequestError(
      400,
      parsedScopes.error.issues[0]?.message ?? "Invalid agent scopes."
    );
  }
  const scopes = parsedScopes.data;

  if (!hasSupabaseConfig()) {
    const store = getMemoryStore();
    ensureUniqueAgentName(store, context.teamId, name);

    const createdAt = new Date().toISOString();
    const agent: AgentRecord = {
      id: randomUUID(),
      teamId: context.teamId,
      name,
      description: input.description.trim(),
      status: "active",
      scopes,
      lastSeen: null,
      createdBy: context.actorUserId,
      createdAt,
    };
    store.push(agent);

    return {
      agent: stripTeamId(agent),
      plaintextKey: generateAgentKey(context.teamSlug).plaintextKey,
    };
  }

  await ensureSupabaseUniqueAgentName(context.teamId, name);

  const memberId = randomUUID();
  const { plaintextKey, keyPrefix } = generateAgentKey(
    await getTeamSlug(context.teamId, context.teamSlug)
  );
  const keyHash = await hashKey(plaintextKey);

  const createUrl = supabaseRestUrl("/rpc/admin_create_agent_member");
  const [insertedMember] = await supabaseFetch<SupabaseAgentRow[]>(createUrl, {
    method: "POST",
    body: JSON.stringify({
      p_team_id: context.teamId,
      p_member_id: memberId,
      p_name: name,
      p_description: input.description.trim(),
      p_scopes: scopes,
      p_created_by_user_id: context.actorUserId,
      p_key_name: `${name} primary key`,
      p_key_prefix: keyPrefix,
      p_key_hash: keyHash,
    }),
  });

  if (!insertedMember) {
    throw new RequestError(500, "Agent creation did not return an agent.");
  }

  return {
    agent: agentFromSupabaseRow(insertedMember),
    plaintextKey,
  };
}

export async function revokeAgent(
  context: AdminAgentsContext,
  agentId: string
): Promise<AgentSummary> {
  assertCanManage(context);

  if (!hasSupabaseConfig()) {
    const store = getMemoryStore();
    const agent = store.find(
      (candidate) =>
        candidate.teamId === context.teamId && candidate.id === agentId
    );
    if (!agent) throw new RequestError(404, "Agent not found.");

    agent.status = "revoked";
    return stripTeamId(agent);
  }

  const now = new Date().toISOString();
  const revokeUrl = supabaseRestUrl("/rpc/admin_revoke_agent_member");
  const [updatedMember] = await supabaseFetch<SupabaseAgentRow[]>(revokeUrl, {
    method: "POST",
    body: JSON.stringify({
      p_team_id: context.teamId,
      p_member_id: agentId,
      p_revoked_at: now,
    }),
  });

  if (!updatedMember) {
    throw new RequestError(404, "Agent not found.");
  }

  return agentFromSupabaseRow(updatedMember);
}

export class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function parseRole(value: string | null | undefined): AdminRole {
  if (value === "member" || value === "admin" || value === "owner") {
    return value;
  }

  return "owner";
}

function assertCanManage(context: AdminAgentsContext): void {
  if (!context.canManage) {
    throw new RequestError(403, "Members can view agents but cannot manage them.");
  }
}

function assertLocalAdminRoute(): void {
  if (process.env.NODE_ENV === "production") {
    throw new RequestError(
      501,
      "Agent admin routes require authenticated authorization outside local development."
    );
  }
}

function getMemoryStore(): AgentRecord[] {
  const globalStore = globalThis as GlobalAgentStore;
  globalStore.__secondBrainAdminAgents ??= [
    {
      id: "00000000-0000-0000-0000-0000000000c1",
      teamId: DEV_TEAM_ID,
      name: "dev-cli",
      description: "Seeded local CLI agent",
      status: "active",
      scopes: scopeTemplates.writer,
      lastSeen: null,
      createdBy: DEV_USER_ID,
      createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    },
  ];

  return globalStore.__secondBrainAdminAgents;
}

function ensureUniqueAgentName(
  store: AgentRecord[],
  teamId: string,
  name: string
): void {
  const normalized = name.toLowerCase();
  const existing = store.find(
    (agent) =>
      agent.teamId === teamId && agent.name.toLowerCase() === normalized
  );

  if (existing) {
    throw new RequestError(409, "Agent name is already used by this team.");
  }
}

async function ensureSupabaseUniqueAgentName(
  teamId: string,
  name: string
): Promise<void> {
  const agents = await listAgents({
    teamId,
    teamSlug: "dev",
    actorUserId: DEV_USER_ID,
    role: "owner",
    canManage: true,
  });
  const normalized = name.toLowerCase();

  if (agents.some((agent) => agent.name.toLowerCase() === normalized)) {
    throw new RequestError(409, "Agent name is already used by this team.");
  }
}

function stripTeamId({ teamId: _teamId, ...agent }: AgentRecord): AgentSummary {
  return agent;
}

function agentFromSupabaseRow(row: SupabaseAgentRow): AgentSummary {
  return {
    id: row.member_id,
    name: row.display_name,
    description: row.description ?? "",
    status: row.active && row.revoked_at === null ? "active" : "revoked",
    scopes: AgentScopesSchema.parse(row.scopes),
    lastSeen: row.last_seen_at,
    createdBy: row.created_by_user_id,
    createdAt: row.joined_at,
  };
}

function generateAgentKey(teamSlug: string): GeneratedAgentKey {
  const slug = teamSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const teamSegment = slug || "team";
  const publicId = randomBytes(6).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  const keyPrefix = `sb_live_${teamSegment}_${publicId}`;

  return {
    plaintextKey: `${keyPrefix}_${secret}`,
    keyPrefix,
  };
}

async function hashKey(plaintext: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const key = await scryptKey(plaintext, salt, 64, {
    N: 16_384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });

  return `scrypt$16384$8$1$${salt}$${key.toString("base64url")}`;
}

function scryptKey(
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
  );
}

async function getTeamSlug(teamId: string, fallback: string): Promise<string> {
  if (!hasSupabaseConfig()) return fallback;

  const url = supabaseRestUrl("/teams");
  url.searchParams.set("id", `eq.${teamId}`);
  url.searchParams.set("select", "slug");
  url.searchParams.set("limit", "1");

  const rows = await supabaseFetch<SupabaseTeamRow[]>(url);
  return rows[0]?.slug ?? fallback;
}

function supabaseRestUrl(path: string): URL {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new RequestError(500, "Supabase URL is not configured.");

  return new URL(`/rest/v1${path}`, base);
}

async function supabaseFetch<T = unknown>(
  url: URL,
  init: RequestInit = {}
): Promise<T> {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new RequestError(500, "Supabase secret key is not configured.");

  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new RequestError(response.status, message || response.statusText);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
