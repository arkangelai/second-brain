import type { Metadata } from "next";

import { AgentsAdminClient, type RequestedRole } from "./agents-admin-client";

export const metadata: Metadata = {
  title: "Agent Registry | Second Brain",
};

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  const requestedRole: RequestedRole =
    role === "member" || role === "admin" || role === "owner"
      ? role
      : undefined;

  return <AgentsAdminClient requestedRole={requestedRole} />;
}
