import type { Metadata } from "next";

import { TeamAdminClient } from "./team-admin-client";
import { AdminTeamError, getTeamAdminPageData } from "@/lib/admin/team";

export const metadata: Metadata = {
  title: "Team Admin | Second Brain",
};

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  try {
    const data = await getTeamAdminPageData();

    return <TeamAdminClient data={data} />;
  } catch (error) {
    return <AdminTeamErrorState error={error} />;
  }
}

function AdminTeamErrorState({ error }: { error: unknown }) {
  const message =
    error instanceof AdminTeamError
      ? error.message
      : "The team admin page could not be loaded.";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          Team admin unavailable
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Check your team access
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      </section>
    </main>
  );
}
