import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Building2, Shield, Users } from "lucide-react";

import {
  ACTIVE_TEAM_COOKIE,
  getDefaultTeamId,
  getHumanMemberships,
  resolveActiveTeamId,
} from "@/lib/auth/active-team";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminTeamPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/team");
  }

  const cookieStore = await cookies();
  const memberships = await getHumanMemberships(supabase, user.id);
  const defaultTeamId = await getDefaultTeamId(supabase, user.id);
  const activeTeamId = resolveActiveTeamId(
    memberships,
    cookieStore.get(ACTIVE_TEAM_COOKIE)?.value,
    defaultTeamId
  );
  const activeMembership = memberships.find((membership) => membership.teamId === activeTeamId);

  if (!activeMembership) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{activeMembership.team.name}</h1>
        <p className="text-sm text-muted-foreground">
          Team settings and membership for {activeMembership.team.slug}.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 text-card-foreground">
          <Building2 className="mb-4 size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Active team</p>
          <p className="mt-1 font-medium">{activeMembership.team.name}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 text-card-foreground">
          <Shield className="mb-4 size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Your role</p>
          <p className="mt-1 capitalize font-medium">{activeMembership.role}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 text-card-foreground">
          <Users className="mb-4 size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Teams</p>
          <p className="mt-1 font-medium">{memberships.length}</p>
        </div>
      </section>
    </main>
  );
}
