"use server";

import { revalidatePath } from "next/cache";

import {
  AdminTeamError,
  cancelInvitation,
  createInvitation,
  isTeamRole,
  removeMember,
  renameTeam,
  updateMemberRole,
  validateInviteEmail,
  validateTeamName,
  type PendingInvitation,
  type TeamMember,
  type TeamRole,
  type TeamSummary,
} from "@/lib/admin/team";

type ActionFailure = {
  ok: false;
  message: string;
  status: number;
};

type ActionSuccess<T = undefined> = {
  ok: true;
  message: string;
} & (T extends undefined ? object : { data: T });

export type ActionResult<T = undefined> = ActionFailure | ActionSuccess<T>;

export async function renameTeamAction(
  formData: FormData
): Promise<ActionResult<TeamSummary>> {
  try {
    const team = await renameTeam(validateTeamName(formData.get("name")));
    revalidatePath("/admin/team");

    return {
      ok: true,
      message: "Team renamed.",
      data: team,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateMemberRoleAction(
  formData: FormData
): Promise<ActionResult<TeamMember>> {
  try {
    const userId = String(formData.get("userId") ?? "");
    const role = formData.get("role");

    if (!userId) {
      throw new AdminTeamError("Member is required.");
    }
    if (!isTeamRole(role)) {
      throw new AdminTeamError("Choose a valid role.");
    }

    const member = await updateMemberRole(userId, role);
    revalidatePath("/admin/team");

    return {
      ok: true,
      message: "Member role updated.",
      data: member,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeMemberAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const userId = String(formData.get("userId") ?? "");

    if (!userId) {
      throw new AdminTeamError("Member is required.");
    }

    await removeMember(userId);
    revalidatePath("/admin/team");

    return {
      ok: true,
      message: "Member removed.",
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function createInvitationAction(
  formData: FormData
): Promise<ActionResult<{ invitation: PendingInvitation; link: string }>> {
  try {
    const email = validateInviteEmail(formData.get("email"));
    const roleValue = formData.get("role");

    if (!isTeamRole(roleValue)) {
      throw new AdminTeamError("Choose a valid role.");
    }

    const invitation = await createInvitation(email, roleValue);
    revalidatePath("/admin/team");

    return {
      ok: true,
      message: "Invitation created.",
      data: invitation,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelInvitationAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const invitationId = String(formData.get("invitationId") ?? "");

    if (!invitationId) {
      throw new AdminTeamError("Invitation is required.");
    }

    await cancelInvitation(invitationId);
    revalidatePath("/admin/team");

    return {
      ok: true,
      message: "Invitation canceled.",
    };
  } catch (error) {
    return actionError(error);
  }
}

function actionError(error: unknown): ActionFailure {
  if (error instanceof AdminTeamError) {
    return {
      ok: false,
      message: error.message,
      status: error.status,
    };
  }

  return {
    ok: false,
    message: "Something went wrong.",
    status: 500,
  };
}

export type RoleAction = typeof updateMemberRoleAction;
export type RemoveMemberAction = typeof removeMemberAction;
export type RenameTeamAction = typeof renameTeamAction;
export type CreateInvitationAction = typeof createInvitationAction;
export type CancelInvitationAction = typeof cancelInvitationAction;
export type { TeamRole };
