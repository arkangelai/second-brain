"use client";

import { ChevronDown } from "lucide-react";
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
    <label className="group relative inline-flex items-center gap-2 rounded-md border border-stone-800/80 bg-stone-950/60 pl-3 pr-2 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.24em] text-stone-400 transition focus-within:border-amber-200/60 hover:border-stone-700">
      <span>Vault</span>
      <select
        value={value}
        onChange={(event) => void switchTeam(event.target.value)}
        disabled={isSwitching}
        className="h-9 min-w-40 appearance-none bg-transparent pr-5 text-stone-100 outline-none disabled:opacity-50"
      >
        {memberships.map((membership) => (
          <option
            key={membership.teamId}
            value={membership.teamId}
            className="bg-stone-950 text-stone-100"
          >
            {membership.team.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none size-3.5 text-stone-500"
        aria-hidden
      />
    </label>
  );
}
