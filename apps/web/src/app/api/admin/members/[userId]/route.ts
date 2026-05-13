import {
  AdminTeamError,
  isTeamRole,
  removeMember,
  updateMemberRole,
} from "@/lib/admin/team";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { userId } = await params;
    const body = await request.json();

    if (!isTeamRole(body.role)) {
      throw new AdminTeamError("Choose a valid role.");
    }

    const member = await updateMemberRole(userId, body.role);

    return Response.json({ member });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { userId } = await params;
    await removeMember(userId);

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

function jsonError(error: unknown): Response {
  if (error instanceof AdminTeamError) {
    return Response.json(
      { error: error.message },
      { status: error.status }
    );
  }

  return Response.json({ error: "Something went wrong." }, { status: 500 });
}
