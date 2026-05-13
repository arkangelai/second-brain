import {
  AdminTeamError,
  renameTeam,
  validateTeamName,
} from "@/lib/admin/team";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const team = await renameTeam(validateTeamName(body.name));

    return Response.json({ team });
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
