import { HttpError } from "@/lib/http/errors";
import { hashInvitationToken } from "@/lib/invitations/tokens";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type InvitationPreviewStatus = "valid" | "gone";

export interface InvitationPreview {
  status: InvitationPreviewStatus;
  email?: string;
  role?: string;
  teamName?: string;
  inviterName?: string;
}

interface InvitationRow {
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  invited_by: string;
  teams: { name: string } | null;
}

export async function getInvitationPreview(
  token: string
): Promise<InvitationPreview> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("team_invitations")
    .select("email, role, expires_at, accepted_at, invited_by, teams(name)")
    .eq("token_hash", hashInvitationToken(token))
    .maybeSingle<InvitationRow>();

  if (error) {
    throw new HttpError(
      500,
      "Unable to load invitation",
      "invite_preview_error"
    );
  }

  if (!data || data.accepted_at || new Date(data.expires_at) <= new Date()) {
    return { status: "gone" };
  }

  const { data: inviter, error: inviterError } = await admin
    .from("user_profiles")
    .select("full_name")
    .eq("user_id", data.invited_by)
    .maybeSingle<{ full_name: string | null }>();

  if (inviterError) {
    throw new HttpError(
      500,
      "Unable to load invitation sender",
      "invite_preview_error"
    );
  }

  return {
    status: "valid",
    email: data.email,
    role: data.role,
    teamName: data.teams?.name ?? "Second Brain",
    inviterName: inviter?.full_name ?? "A teammate",
  };
}
