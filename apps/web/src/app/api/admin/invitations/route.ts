import { z } from "zod";

import {
  assertCanInviteRole,
  requireAdminContext,
  teamRoles,
} from "@/lib/auth/admin-context";
import { sendEmail } from "@/lib/email/client";
import { InvitationEmail } from "@/lib/email/templates/invitation";
import { toErrorResponse } from "@/lib/http/errors";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "@/lib/invitations/tokens";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/url";

const invitationBodySchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: z.enum(teamRoles),
});

const invitationSelect =
  "id, email, role, expires_at, accepted_at, accepted_by, invited_by, created_at";

export async function GET(request: Request) {
  try {
    const context = await requireAdminContext(request);
    const admin = createAdminSupabaseClient();

    const { data, error } = await admin
      .from("team_invitations")
      .select(invitationSelect)
      .eq("team_id", context.team.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return Response.json({ invitations: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAdminContext(request);
    const body = invitationBodySchema.parse(await request.json());
    assertCanInviteRole(context.role, body.role);

    const admin = createAdminSupabaseClient();
    const token = generateInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const acceptLink = appUrl(`/invite/${token}`);

    const { data: existing, error: existingError } = await admin
      .from("team_invitations")
      .select("id")
      .eq("team_id", context.team.id)
      .eq("email", body.email)
      .is("accepted_at", null)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (existingError) {
      throw existingError;
    }

    const payload = {
      team_id: context.team.id,
      email: body.email,
      role: body.role,
      token_hash: tokenHash,
      expires_at: expiresAt,
      invited_by: context.user.id,
    };

    const query = existing
      ? admin
          .from("team_invitations")
          .update(payload)
          .eq("id", existing.id)
          .select(invitationSelect)
          .single()
      : admin
          .from("team_invitations")
          .insert(payload)
          .select(invitationSelect)
          .single();

    const { data: invitation, error: invitationError } = await query;

    if (invitationError) {
      throw invitationError;
    }

    const subject = `${context.inviterName} invited you to the ${context.team.name} brain on Second Brain`;
    const emailResult = await sendEmail({
      to: body.email,
      subject,
      react: InvitationEmail({
        teamName: context.team.name,
        inviterName: context.inviterName,
        role: body.role,
        acceptLink,
      }),
      text: `${context.inviterName} invited you to ${context.team.name} as ${body.role}. Accept: ${acceptLink}`,
      devLink: acceptLink,
    });

    return Response.json(
      {
        invitation,
        email: emailResult,
        acceptLink: emailResult.dev ? acceptLink : undefined,
      },
      { status: existing ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid invitation body", code: "invalid_body" },
        { status: 400 }
      );
    }

    return toErrorResponse(error);
  }
}
