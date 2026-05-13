import {
  AdminTeamError,
  cancelInvitation,
  regenerateInvitationLink,
} from "@/lib/admin/team";

type RouteContext = {
  params: Promise<{
    invitationId: string;
  }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { invitationId } = await params;
    const result = await regenerateInvitationLink(invitationId);

    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { invitationId } = await params;
    await cancelInvitation(invitationId);

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
