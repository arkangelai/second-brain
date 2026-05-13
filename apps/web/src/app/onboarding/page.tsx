import { redirect } from "next/navigation";

import { OnboardingForm, type PendingInvite } from "@/app/onboarding/onboarding-form";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type InvitationRow = {
  id: string;
  role: string;
  teams:
    | {
        name: string;
        slug: string;
      }
    | {
        name: string;
        slug: string;
      }[]
    | null;
};

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = user.email
    ? await admin
        .from("team_invitations")
        .select("id, role, teams:teams(name, slug)")
        .eq("email", user.email)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (error) {
    throw error;
  }

  const invites: PendingInvite[] = ((data ?? []) as InvitationRow[]).flatMap((row) => {
    const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;

    if (!team) return [];

    return [
      {
        id: row.id,
        teamName: team.name,
        teamSlug: team.slug,
        role: row.role,
      },
    ];
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
        <p className="text-sm text-muted-foreground">
          Welcome. Create your team's brain or accept an invitation below.
        </p>
      </header>

      <OnboardingForm invites={invites} />
    </main>
  );
}
