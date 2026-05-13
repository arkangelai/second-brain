import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { TeamSwitcher } from "@/app/admin/team-switcher";
import {
  ACTIVE_TEAM_COOKIE,
  getDefaultTeamId,
  getHumanMemberships,
  resolveActiveTeamId,
} from "@/lib/auth/active-team";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/team");
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
    defaultTeamId
  );

  if (!activeTeamId) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="font-semibold tracking-tight">Second Brain</div>
          <TeamSwitcher memberships={memberships} activeTeamId={activeTeamId} />
        </div>
      </header>
      {children}
    </div>
  );
}
