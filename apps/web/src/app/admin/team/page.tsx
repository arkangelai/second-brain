import type { Metadata } from "next";

import { TeamAdminClient } from "./team-admin-client";
import { ArchiveCard, ArchiveEyebrow } from "@/components/archive/archive-shell";
import { AdminTeamError, getTeamAdminPageData } from "@/lib/admin/team";

export const metadata: Metadata = {
  title: "Team Admin | Second Brain",
};

export const dynamic = "force-dynamic";

interface AdminTeamPageProps {
  searchParams: Promise<{
    invite?: string;
  }>;
}

export default async function AdminTeamPage({
  searchParams,
}: AdminTeamPageProps) {
  const params = await searchParams;

  try {
    const data = await getTeamAdminPageData();

    return (
      <TeamAdminClient
        data={data}
        inviteAccepted={params.invite === "accepted"}
      />
    );
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
    <main className="flex min-h-[60dvh] items-center justify-center px-6 py-12">
      <ArchiveCard
        index="Card / 0399"
        kind="error"
        className="w-full max-w-lg hover:rotate-0"
        rotate={-0.3}
      >
        <ArchiveEyebrow tone="amber" className="mb-3">
          Team admin unavailable
        </ArchiveEyebrow>
        <h1
          className="font-[family-name:var(--font-fraunces)] text-[2rem] leading-tight text-stone-100"
          style={{ fontVariationSettings: "'opsz' 48" }}
        >
          Check your team access
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-400">{message}</p>
      </ArchiveCard>
    </main>
  );
}
