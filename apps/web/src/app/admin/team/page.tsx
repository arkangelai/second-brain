import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

interface MembershipRow {
  team_id: string;
  role: string;
}

interface AdminTeamPageProps {
  searchParams: Promise<{
    invite?: string;
  }>;
}

export default async function AdminTeamPage({
  searchParams,
}: AdminTeamPageProps) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/team");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("default_team_id")
    .eq("user_id", user.id)
    .maybeSingle<{ default_team_id: string | null }>();

  const { data: membership } = profile?.default_team_id
    ? await supabase
        .from("team_members")
        .select("team_id, role")
        .eq("member_type", "human")
        .eq("user_id", user.id)
        .eq("team_id", profile.default_team_id)
        .maybeSingle<MembershipRow>()
    : { data: null };

  const { data: fallbackMembership } = membership
    ? { data: null }
    : await supabase
        .from("team_members")
        .select("team_id, role")
        .eq("member_type", "human")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: true })
        .order("team_id", { ascending: true })
        .limit(1)
        .maybeSingle<MembershipRow>();

  const activeMembership = membership ?? fallbackMembership;

  if (!activeMembership) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">No team found</h1>
      </main>
    );
  }

  const { data: team } = await supabase
    .from("teams")
    .select("name, slug")
    .eq("id", activeMembership.team_id)
    .single<{ name: string; slug: string }>();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6 py-12">
      {params.invite === "accepted" ? (
        <p className="rounded-md border border-border bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          Invitation accepted.
        </p>
      ) : null}
      <header className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Second Brain</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {team?.name ?? "Team"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {user.email} · {activeMembership.role}
        </p>
      </header>
    </main>
  );
}
