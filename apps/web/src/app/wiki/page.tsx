import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowUpRight, BookOpen, BotMessageSquare, Users } from "lucide-react";

import { TeamSwitcher } from "@/app/admin/team-switcher";
import {
  ArchiveBackdrop,
  ArchiveEyebrow,
} from "@/components/archive/archive-shell";
import {
  ACTIVE_TEAM_COOKIE,
  getDefaultTeamId,
  getHumanMemberships,
  resolveActiveTeamId,
} from "@/lib/auth/active-team";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { WikiClient } from "./wiki-client";

export const metadata: Metadata = {
  title: "Wiki | Second Brain",
};

export default async function WikiPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/wiki");
  }

  const cookieStore = await cookies();
  const memberships = await getHumanMemberships(supabase, user.id);

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const defaultTeamId = await getDefaultTeamId(supabase, user.id);
  const activeTeamId = resolveActiveTeamId(
    memberships,
    cookieStore.get(ACTIVE_TEAM_COOKIE)?.value,
    defaultTeamId,
  );

  if (!activeTeamId) {
    redirect("/onboarding");
  }

  const activeMembership = memberships.find(
    (membership) => membership.teamId === activeTeamId,
  );

  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-[#0b0f0d] text-stone-200 antialiased">
      <ArchiveBackdrop variant="spread" />

      <header className="relative border-b border-stone-800/70 bg-stone-950/40 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-5">
            <Link
              href="/wiki"
              className="flex items-center gap-3 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.24em] text-stone-300 transition hover:text-teal-100"
            >
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-300/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-300" />
              </span>
              <span>Second Brain</span>
              <span className="text-stone-700">/</span>
              <span className="text-stone-400">Wiki</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              <WikiNavLink
                href="/wiki"
                icon={<BookOpen className="size-3.5" aria-hidden />}
                active
              >
                Wiki
              </WikiNavLink>
              <WikiNavLink
                href="/admin/team"
                icon={<Users className="size-3.5" aria-hidden />}
              >
                Team
              </WikiNavLink>
              <WikiNavLink
                href="/admin/agents"
                icon={<BotMessageSquare className="size-3.5" aria-hidden />}
              >
                Agents
              </WikiNavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <TeamSwitcher
              memberships={memberships}
              activeTeamId={activeTeamId}
            />
            <ArchiveEyebrow
              tone="muted"
              className="hidden text-[10px] sm:inline-flex"
            >
              <span className="size-1.5 rounded-full bg-emerald-300/80" />
              <span>{user.email}</span>
            </ArchiveEyebrow>
          </div>
        </div>
        <div className="border-t border-stone-800/60 bg-stone-950/30 md:hidden">
          <div className="mx-auto flex max-w-[1440px] items-center gap-1 px-4 py-2">
            <WikiNavLink
              href="/wiki"
              icon={<BookOpen className="size-3.5" aria-hidden />}
              active
            >
              Wiki
            </WikiNavLink>
            <WikiNavLink
              href="/admin/team"
              icon={<Users className="size-3.5" aria-hidden />}
            >
              Team
            </WikiNavLink>
            <WikiNavLink
              href="/admin/agents"
              icon={<BotMessageSquare className="size-3.5" aria-hidden />}
            >
              Agents
            </WikiNavLink>
          </div>
        </div>
      </header>

      <WikiClient
        activeTeamId={activeTeamId}
        teamName={activeMembership?.team.name ?? "Team"}
        canAdmin={
          activeMembership?.role === "owner" || activeMembership?.role === "admin"
        }
      />
    </div>
  );
}

function WikiNavLink({
  href,
  icon,
  children,
  active = false,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "group inline-flex items-center gap-2 rounded-md border border-teal-300/30 bg-teal-300/10 px-3 py-1.5 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.24em] text-teal-100 transition"
          : "group inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.24em] text-stone-400 transition hover:bg-stone-900/60 hover:text-stone-100"
      }
    >
      {icon}
      <span>{children}</span>
      {!active ? (
        <ArrowUpRight
          className="size-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-60"
          aria-hidden
        />
      ) : null}
    </Link>
  );
}
