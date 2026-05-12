import { requireAdminContext } from "@/lib/auth/admin-context";
import { HttpError, toErrorResponse } from "@/lib/http/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await requireAdminContext(request);
    const admin = createAdminSupabaseClient();

    const { data, error } = await admin
      .from("team_invitations")
      .delete()
      .eq("id", id)
      .eq("team_id", context.team.id)
      .is("accepted_at", null)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new HttpError(404, "Pending invitation not found", "not_found");
    }

    return Response.json({ cancelled: true, id: data.id });
  } catch (error) {
    return toErrorResponse(error);
  }
}
