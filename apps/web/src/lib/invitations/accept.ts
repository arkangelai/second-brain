import { HttpError } from "@/lib/http/errors";
import { hashInvitationToken } from "@/lib/invitations/tokens";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type AcceptStatus = "accepted" | "gone" | "email_mismatch";

interface AcceptResult {
  status: AcceptStatus;
  team_id: string | null;
  role: string | null;
}

export async function acceptInvitationToken(token: string, userId: string) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .rpc("accept_team_invitation", {
      invite_token_hash: hashInvitationToken(token),
      accepting_user: userId,
    })
    .single<AcceptResult>();

  if (error) {
    throw new HttpError(500, "Unable to accept invitation", "accept_error");
  }

  if (!data || data.status === "gone") {
    throw new HttpError(410, "Invitation expired or already used", "invite_gone");
  }

  if (data.status === "email_mismatch") {
    throw new HttpError(
      403,
      "Sign in with the email address this invite was sent to",
      "email_mismatch"
    );
  }

  return data;
}
