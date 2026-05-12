import { z } from "zod";

import { HttpError, toErrorResponse } from "@/lib/http/errors";
import { acceptInvitationToken } from "@/lib/invitations/accept";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const acceptBodySchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { token } = acceptBodySchema.parse(await request.json());
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new HttpError(401, "Authentication required", "unauthorized");
    }

    const result = await acceptInvitationToken(token, user.id);
    return Response.json({
      status: "accepted",
      teamId: result.team_id,
      role: result.role,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid accept body", code: "invalid_body" },
        { status: 400 }
      );
    }

    return toErrorResponse(error);
  }
}
