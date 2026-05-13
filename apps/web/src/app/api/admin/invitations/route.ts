import {
  AdminTeamError,
  createInvitation,
  getTeamAdminPageData,
  isTeamRole,
  validateInviteEmail,
} from "@/lib/admin/team";

export async function GET() {
  try {
    const data = await getTeamAdminPageData();

    return Response.json({ invitations: data.invitations });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = validateInviteEmail(body.email);

    if (!isTeamRole(body.role)) {
      throw new AdminTeamError("Choose a valid role.");
    }

    const result = await createInvitation(email, body.role);

    return Response.json(result, { status: 201 });
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
