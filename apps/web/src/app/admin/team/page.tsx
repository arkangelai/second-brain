import { resolveHumanPrincipal } from "@/lib/auth/human-principal";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminTeamPage() {
  const principal = await resolveHumanPrincipal({ headers: await headers() });

  if (!principal) {
    redirect("/login?next=/admin/team");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">Team {principal.team_id}</p>
      </header>

      <section className="rounded-lg border border-border bg-card p-6 text-sm text-card-foreground">
        <p className="text-muted-foreground">Signed in as {principal.role}.</p>
      </section>
    </main>
  );
}
