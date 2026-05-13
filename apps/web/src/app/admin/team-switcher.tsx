"use client";

import { useState } from "react";

import type { TeamMembership } from "@/lib/auth/active-team";

export function TeamSwitcher({
  memberships,
  activeTeamId,
}: {
  memberships: TeamMembership[];
  activeTeamId: string;
}) {
  const [value, setValue] = useState(activeTeamId);
  const [isSwitching, setIsSwitching] = useState(false);

  if (memberships.length < 2) return null;

  async function switchTeam(teamId: string) {
    setValue(teamId);
    setIsSwitching(true);

    const response = await fetch("/api/admin/team-switch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ teamId }),
    });

    if (response.ok) {
      window.location.reload();
      return;
    }

    setIsSwitching(false);
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Team</span>
      <select
        value={value}
        onChange={(event) => void switchTeam(event.target.value)}
        disabled={isSwitching}
        className="h-9 min-w-40 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
      >
        {memberships.map((membership) => (
          <option key={membership.teamId} value={membership.teamId}>
            {membership.team.name}
          </option>
        ))}
      </select>
    </label>
  );
}
