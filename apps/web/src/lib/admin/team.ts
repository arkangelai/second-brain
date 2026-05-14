import "server-only";

import { cookies } from "next/headers";

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
import {
  generateInvitationToken,
  hashInvitationToken,
} from "@/lib/invitations/tokens";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const INVITATION_TTL_DAYS = 7;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export { TEAM_ROLES };
export type {
  AdminTeamPageData,
  PendingInvitation,
  TeamMember,
  TeamRole,
  TeamSummary,
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
  const supabase = await createServerSupabaseClient();
  const requestedTeam = await requestedTeamId();
  const { data, error } = await supabase.rpc("app_team_admin_page", {
    requested_team: requestedTeam,
  });

  if (error) {
    throw rpcError(error);
  }

  return data as AdminTeamPageData;
}

export async function renameTeam(name: string): Promise<TeamSummary> {
  const supabase = await createServerSupabaseClient();
  const requestedTeam = await requestedTeamId();
  const { data, error } = await supabase.rpc("app_rename_team", {
    requested_team: requestedTeam,
    new_name: name,
  });

  if (error) {
    throw rpcError(error);
  }

  return data as TeamSummary;
}

export async function updateMemberRole(
  userId: string,
  role: TeamRole
): Promise<TeamMember> {
  const supabase = await createServerSupabaseClient();
  const requestedTeam = await requestedTeamId();
  const { data, error } = await supabase.rpc("app_update_team_member_role", {
    requested_team: requestedTeam,
    target_user: userId,
    next_role: role,
  });

  if (error) {
    throw rpcError(error);
  }

  return data as TeamMember;
}

export async function removeMember(userId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const requestedTeam = await requestedTeamId();
  const { error } = await supabase.rpc("app_remove_team_member", {
    requested_team: requestedTeam,
    target_user: userId,
  });

  if (error) {
    throw rpcError(error);
  }
}

export async function createInvitation(
  email: string,
  role: TeamRole
): Promise<{ invitation: PendingInvitation; link: string }> {
  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);

  const supabase = await createServerSupabaseClient();
  const requestedTeam = await requestedTeamId();
  const { data: principals, error: principalError } = await supabase.rpc(
    "app_resolve_human_principal",
    { requested_team: requestedTeam }
  );

  if (principalError) {
    throw rpcError(principalError);
  }

  const principal = principals[0];
  if (!principal) {
    throw new AdminTeamError("Authentication required.", 401);
  }

  const { data, error } = await supabase.rpc("app_create_team_invitation", {
    requested_team: requestedTeam,
    invite_email: email,
    invite_role: role,
    invite_token_hash: tokenHash,
    invite_expires_at: expiresAt.toISOString(),
  });

  if (error) {
    throw rpcError(error);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const inviterName = inviterDisplayName(user);
  const link = invitationLink(token);

  await sendEmail({
    to: email,
    subject: `${inviterName} invited you to the ${principal.team_name} brain on Second Brain`,
    react: InvitationEmail({
      teamName: principal.team_name,
      inviterName,
      role,
      acceptLink: link,
    }),
    text: `${inviterName} invited you to ${principal.team_name} as ${role}. Accept: ${link}`,
    devLink: link,
  });

  return {
    invitation: data as PendingInvitation,
    link,
  };
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const requestedTeam = await requestedTeamId();
  const { error } = await supabase.rpc("app_cancel_team_invitation", {
    requested_team: requestedTeam,
    invitation_id: invitationId,
  });

  if (error) {
    throw rpcError(error);
  }
}

export async function regenerateInvitationLink(
  invitationId: string
): Promise<{ invitation: PendingInvitation; link: string }> {
  const token = generateInvitationToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);

  const supabase = await createServerSupabaseClient();
  const requestedTeam = await requestedTeamId();
  const { data, error } = await supabase.rpc(
    "app_regenerate_team_invitation",
    {
      requested_team: requestedTeam,
      invitation_id: invitationId,
      invite_token_hash: hashInvitationToken(token),
      invite_expires_at: expiresAt.toISOString(),
    }
  );

  if (error) {
    throw rpcError(error);
  }

  return {
    invitation: data as PendingInvitation,
    link: invitationLink(token),
  };
}

async function requestedTeamId(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get("sb_active_team")?.value;
  return value && UUID_RE.test(value) ? value : null;
}

function rpcError(error: { message: string; code?: string }): AdminTeamError {
  if (/authentication required/i.test(error.message)) {
    return new AdminTeamError(error.message, 401);
  }

  const status =
    error.code === "42501" || /not have access|only/i.test(error.message)
      ? 403
      : 500;

  return new AdminTeamError(error.message, status);
}

function inviterDisplayName(user: { email?: string; user_metadata?: unknown } | null): string {
  const metadata =
    user?.user_metadata && typeof user.user_metadata === "object"
      ? user.user_metadata
      : null;
  const fullName =
    metadata && "full_name" in metadata && typeof metadata.full_name === "string"
      ? metadata.full_name.trim()
      : "";

  return fullName || user?.email || "A teammate";
}

function invitationLink(token: string): string {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/invite/${token}`;
}
