export const TEAM_ROLES = ["owner", "admin", "member"] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

export type TeamSummary = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

export type TeamMember = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: TeamRole;
  joinedAt: string;
  isCurrentUser: boolean;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: TeamRole;
  invitedAt: string;
  expiresAt: string;
};

export type AdminTeamPageData = {
  team: TeamSummary;
  currentUser: {
    id: string;
    role: TeamRole;
  };
  members: TeamMember[];
  invitations: PendingInvitation[];
  permissions: {
    canRenameTeam: boolean;
    canManageMembers: boolean;
    canManageInvitations: boolean;
  };
};
