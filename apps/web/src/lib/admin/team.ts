import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

import {
  TEAM_ROLES,
  type AdminTeamPageData,
  type PendingInvitation,
  type TeamMember,
  type TeamRole,
  type TeamSummary,
} from "./team-types";
import { sendEmail } from "@/lib/email/client";
import { InvitationEmail } from "@/lib/email/templates/invitation";

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
const INVITATION_TTL_DAYS = 7;
export { TEAM_ROLES };
export type {
  AdminTeamPageData,
  PendingInvitation,
  TeamMember,
  TeamRole,
  TeamSummary,
};

type TeamRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

type TeamMemberRow = {
  team_id: string;
  member_id: string;
  member_type: "human" | "agent";
  user_id: string | null;
  role: TeamRole;
  joined_at: string;
  display_name: string | null;
};

type UserProfileRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  default_team_id: string | null;
};

type InvitationRow = {
  id: string;
  email: string;
  role: TeamRole;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

type TeamIdRow = {
  team_id: string;
};

type TeamContext = {
  supabase: SupabaseClient;
  userId: string;
  teamId: string;
  role: TeamRole;
};

export class AdminTeamError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "AdminTeamError";
  }
}

export function isTeamRole(value: unknown): value is TeamRole {
  return TEAM_ROLES.some((role) => role === value);
}

export function validateTeamName(value: unknown): string {
  if (typeof value !== "string") {
    throw new AdminTeamError("Team name is required.");
  }

  const name = value.trim();
  if (name.length < 2) {
    throw new AdminTeamError("Team name must be at least 2 characters.");
  }
  if (name.length > 80) {
    throw new AdminTeamError("Team name must be 80 characters or fewer.");
  }

  return name;
}

export function validateInviteEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new AdminTeamError("Email is required.");
  }

  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AdminTeamError("Enter a valid email address.");
  }

  return email;
}

export async function getTeamAdminPageData(): Promise<AdminTeamPageData> {
  return withTeamContext(async (ctx) => {
    const [team, members, invitations] = await Promise.all([
      fetchTeam(ctx.supabase, ctx.teamId),
      fetchMembers(ctx.supabase, ctx.teamId, ctx.userId),
      fetchPendingInvitations(ctx.supabase, ctx.teamId),
    ]);

    const canManageMembers = ctx.role === "owner";
    const canManageInvitations = ctx.role === "owner" || ctx.role === "admin";

    return {
      team,
      currentUser: {
        id: ctx.userId,
        role: ctx.role,
      },
      members,
      invitations,
      permissions: {
        canRenameTeam: ctx.role === "owner",
        canManageMembers,
        canManageInvitations,
      },
    };
  });
}

export async function renameTeam(name: string): Promise<TeamSummary> {
  return withTeamContext(async (ctx) => {
    assertOwner(ctx);

    const { data, error } = await ctx.supabase
      .from("teams")
      .update({ name })
      .eq("id", ctx.teamId)
      .select("id, name, slug, created_at")
      .single<TeamRow>();

    if (error) {
      throw new AdminTeamError(error.message, 500);
    }

    return mapTeam(data);
  });
}

export async function updateMemberRole(
  userId: string,
  role: TeamRole
): Promise<TeamMember> {
  return withTeamContext(async (ctx) => {
    assertOwner(ctx);
    await assertCanTouchMember(ctx, userId, role);

    const { data, error } = await ctx.supabase
      .from("team_members")
      .update({ role })
      .eq("team_id", ctx.teamId)
      .eq("user_id", userId)
      .eq("member_type", "human")
      .select("team_id, member_id, member_type, user_id, role, joined_at, display_name")
      .single<TeamMemberRow>();

    if (error) {
      throw new AdminTeamError(error.message, 500);
    }

    const [member] = await hydrateMembers(ctx.supabase, [data], ctx.userId);
    if (!member) {
      throw new AdminTeamError("Member was updated but could not be loaded.", 500);
    }

    return member;
  });
}

export async function removeMember(userId: string): Promise<void> {
  return withTeamContext(async (ctx) => {
    assertOwner(ctx);
    await assertCanTouchMember(ctx, userId, null);

    const { error } = await ctx.supabase
      .from("team_members")
      .delete()
      .eq("team_id", ctx.teamId)
      .eq("user_id", userId)
      .eq("member_type", "human");

    if (error) {
      throw new AdminTeamError(error.message, 500);
    }
  });
}

export async function createInvitation(
  email: string,
  role: TeamRole
): Promise<{ invitation: PendingInvitation; link: string }> {
  return withTeamContext(async (ctx) => {
    assertAdmin(ctx);

    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);

    const { error: deleteError } = await ctx.supabase
      .from("team_invitations")
      .delete()
      .eq("team_id", ctx.teamId)
      .eq("email", email)
      .is("accepted_at", null);

    if (deleteError) {
      throw new AdminTeamError(deleteError.message, 500);
    }

    const { data, error } = await ctx.supabase
      .from("team_invitations")
      .insert({
        team_id: ctx.teamId,
        email,
        role,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        invited_by: ctx.userId,
      })
      .select("id, email, role, expires_at, accepted_at, created_at")
      .single<InvitationRow>();

    if (error) {
      throw new AdminTeamError(error.message, 500);
    }

    const team = await fetchTeam(ctx.supabase, ctx.teamId);
    const inviterName = await fetchInviterName(ctx.supabase, ctx.userId);
    const link = invitationLink(token);
    await sendEmail({
      to: email,
      subject: `${inviterName} invited you to the ${team.name} brain on Second Brain`,
      react: InvitationEmail({
        teamName: team.name,
        inviterName,
        role,
        acceptLink: link,
      }),
      text: `${inviterName} invited you to ${team.name} as ${role}. Accept: ${link}`,
      devLink: link,
    });

    return {
      invitation: mapInvitation(data),
      link,
    };
  });
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  return withTeamContext(async (ctx) => {
    assertAdmin(ctx);

    const { error } = await ctx.supabase
      .from("team_invitations")
      .delete()
      .eq("team_id", ctx.teamId)
      .eq("id", invitationId)
      .is("accepted_at", null);

    if (error) {
      throw new AdminTeamError(error.message, 500);
    }
  });
}

export async function regenerateInvitationLink(
  invitationId: string
): Promise<{ invitation: PendingInvitation; link: string }> {
  return withTeamContext(async (ctx) => {
    assertAdmin(ctx);

    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);

    const { data, error } = await ctx.supabase
      .from("team_invitations")
      .update({
        token_hash: hashInviteToken(token),
        expires_at: expiresAt.toISOString(),
      })
      .eq("team_id", ctx.teamId)
      .eq("id", invitationId)
      .is("accepted_at", null)
      .select("id, email, role, expires_at, accepted_at, created_at")
      .single<InvitationRow>();

    if (error) {
      throw new AdminTeamError(error.message, 500);
    }

    return {
      invitation: mapInvitation(data),
      link: invitationLink(token),
    };
  });
}

async function withTeamContext<T>(
  callback: (context: TeamContext) => Promise<T>
): Promise<T> {
  const supabase = createAdminClient();
  const userId = await resolveCurrentUserId(supabase);
  const teamId = await resolveActiveTeamId(supabase, userId);
  const membership = await fetchCurrentMembership(supabase, teamId, userId);

  return callback({
    supabase,
    userId,
    teamId,
    role: membership.role,
  });
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new AdminTeamError(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.",
      500
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function resolveCurrentUserId(supabase: SupabaseClient): Promise<string> {
  const headerStore = await headers();
  const cookieStore = await cookies();

  if (process.env.NODE_ENV !== "production") {
    const explicitUser =
      headerStore.get("x-second-brain-user-id") ?? cookieStore.get("sb_user_id")?.value;
    if (explicitUser) {
      return explicitUser;
    }
    return DEV_USER_ID;
  }

  const token =
    bearerToken(headerStore.get("authorization")) ??
    cookieStore.get("sb-access-token")?.value ??
    accessTokenFromSupabaseCookies(cookieStore.getAll());

  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      return data.user.id;
    }
  }

  throw new AdminTeamError("Authentication required.", 401);
}

function bearerToken(authorization: string | null): string | null {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function accessTokenFromSupabaseCookies(
  cookies: Array<{ name: string; value: string }>
): string | null {
  const authCookieNames = new Set(
    cookies
      .map(({ name }) => name.replace(/\.\d+$/, ""))
      .filter((name) => /^sb-.+-auth-token$/.test(name))
  );

  for (const name of authCookieNames) {
    const value = cookies
      .filter((cookie) => cookie.name === name || cookie.name.startsWith(`${name}.`))
      .sort((a, b) => authCookieChunkIndex(a.name) - authCookieChunkIndex(b.name))
      .map((cookie) => cookie.value)
      .join("");
    const token = accessTokenFromSupabaseCookieValue(value);
    if (token) {
      return token;
    }
  }

  return null;
}

function authCookieChunkIndex(name: string): number {
  const match = name.match(/\.(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function accessTokenFromSupabaseCookieValue(value: string): string | null {
  for (const candidate of decodedCookieCandidates(value)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed) && typeof parsed[0] === "string") {
        return parsed[0];
      }
      if (
        parsed &&
        typeof parsed === "object" &&
        "access_token" in parsed &&
        typeof parsed.access_token === "string"
      ) {
        return parsed.access_token;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function decodedCookieCandidates(value: string): string[] {
  if (!value.startsWith("base64-")) {
    return [value];
  }

  try {
    return [
      value,
      Buffer.from(value.slice("base64-".length), "base64url").toString("utf8"),
    ];
  } catch {
    return [value];
  }
}

async function resolveActiveTeamId(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const cookieStore = await cookies();
  const cookieTeamId = cookieStore.get("sb_active_team")?.value;

  const { data: memberships, error } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .eq("member_type", "human")
    .order("joined_at", { ascending: true })
    .returns<TeamIdRow[]>();

  if (error) {
    throw new AdminTeamError(error.message, 500);
  }

  const [firstTeamId, ...teamIds] = (memberships ?? []).map(
    (membership) => membership.team_id
  );
  if (!firstTeamId) {
    throw new AdminTeamError("You do not belong to a team yet.", 403);
  }
  const availableTeamIds = [firstTeamId, ...teamIds];

  if (cookieTeamId && availableTeamIds.includes(cookieTeamId)) {
    return cookieTeamId;
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("default_team_id")
    .eq("user_id", userId)
    .maybeSingle<Pick<UserProfileRow, "default_team_id">>();

  if (
    profile?.default_team_id &&
    availableTeamIds.includes(profile.default_team_id)
  ) {
    return profile.default_team_id;
  }

  return firstTeamId;
}

async function fetchCurrentMembership(
  supabase: SupabaseClient,
  teamId: string,
  userId: string
): Promise<TeamMemberRow> {
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, member_id, member_type, user_id, role, joined_at, display_name")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("member_type", "human")
    .single<TeamMemberRow>();

  if (error) {
    throw new AdminTeamError("You do not have access to this team.", 403);
  }

  return data;
}

async function fetchTeam(
  supabase: SupabaseClient,
  teamId: string
): Promise<TeamSummary> {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, slug, created_at")
    .eq("id", teamId)
    .single<TeamRow>();

  if (error) {
    throw new AdminTeamError(error.message, 500);
  }

  return mapTeam(data);
}

async function fetchInviterName(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("user_id", userId)
    .maybeSingle<Pick<UserProfileRow, "full_name">>();

  if (profile?.full_name) {
    return profile.full_name;
  }

  const { data } = await supabase.auth.admin.getUserById(userId);
  return data.user?.email ?? "A teammate";
}

async function fetchMembers(
  supabase: SupabaseClient,
  teamId: string,
  currentUserId: string
): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, member_id, member_type, user_id, role, joined_at, display_name")
    .eq("team_id", teamId)
    .eq("member_type", "human")
    .order("joined_at", { ascending: true });

  if (error) {
    throw new AdminTeamError(error.message, 500);
  }

  return hydrateMembers(supabase, (data ?? []) as TeamMemberRow[], currentUserId);
}

async function hydrateMembers(
  supabase: SupabaseClient,
  rows: TeamMemberRow[],
  currentUserId: string
): Promise<TeamMember[]> {
  const memberRows = rows.filter(
    (row): row is TeamMemberRow & { user_id: string } => Boolean(row.user_id)
  );
  const userIds = memberRows.map((row) => row.user_id);

  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id, full_name, avatar_url, default_team_id")
    .in("user_id", userIds)
    .returns<UserProfileRow[]>();

  const profileByUserId = new Map(
    (profiles ?? []).map((profile) => [profile.user_id, profile])
  );

  const emails = await Promise.all(
    userIds.map(async (userId) => {
      const { data } = await supabase.auth.admin.getUserById(userId);
      return [userId, data.user?.email ?? "Unknown email"] as const;
    })
  );
  const emailByUserId = new Map(emails);

  return memberRows
    .map((row) => {
      const userId = row.user_id;
      const profile = profileByUserId.get(userId);
      const email = emailByUserId.get(userId) ?? "Unknown email";

      return {
        userId,
        name: profile?.full_name ?? row.display_name ?? email,
        email,
        avatarUrl: profile?.avatar_url ?? null,
        role: row.role,
        joinedAt: row.joined_at,
        isCurrentUser: userId === currentUserId,
      };
    });
}

async function fetchPendingInvitations(
  supabase: SupabaseClient,
  teamId: string
): Promise<PendingInvitation[]> {
  const { data, error } = await supabase
    .from("team_invitations")
    .select("id, email, role, expires_at, accepted_at, created_at")
    .eq("team_id", teamId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AdminTeamError(error.message, 500);
  }

  return ((data ?? []) as InvitationRow[]).map(mapInvitation);
}

async function assertCanTouchMember(
  ctx: TeamContext,
  userId: string,
  nextRole: TeamRole | null
): Promise<void> {
  const { data: members, error } = await ctx.supabase
    .from("team_members")
    .select("user_id, role")
    .eq("team_id", ctx.teamId)
    .eq("member_type", "human");

  if (error) {
    throw new AdminTeamError(error.message, 500);
  }

  const target = (members ?? []).find((member) => member.user_id === userId);
  if (!target) {
    throw new AdminTeamError("Member not found.", 404);
  }

  const ownerCount = (members ?? []).filter((member) => member.role === "owner").length;
  const wouldStopBeingOwner = target.role === "owner" && nextRole !== "owner";
  if (wouldStopBeingOwner && ownerCount <= 1) {
    throw new AdminTeamError("A team must keep at least one owner.", 409);
  }
}

function assertOwner(ctx: TeamContext): void {
  if (ctx.role !== "owner") {
    throw new AdminTeamError("Only owners can perform this action.", 403);
  }
}

function assertAdmin(ctx: TeamContext): void {
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    throw new AdminTeamError("Only owners and admins can perform this action.", 403);
  }
}

function mapTeam(row: TeamRow): TeamSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at,
  };
}

function mapInvitation(row: InvitationRow): PendingInvitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    invitedAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function invitationLink(token: string): string {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/invite/${token}`;
}
