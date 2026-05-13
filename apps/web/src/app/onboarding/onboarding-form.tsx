"use client";

import { useEffect, useState } from "react";
import { Building2, Check, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { normalizeTeamSlug } from "@/lib/onboarding/slug";

export type PendingInvite = {
  id: string;
  teamName: string;
  teamSlug: string;
  role: string;
};

type SubmitStatus = "idle" | "submitting" | "error";

export function OnboardingForm({ invites }: { invites: PendingInvite[] }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);

  useEffect(() => {
    if (slugEdited || !name.trim()) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const nextSlug = normalizeTeamSlug(name);
      const response = await fetch(
        `/api/onboarding/slug?value=${encodeURIComponent(nextSlug)}`,
        { signal: controller.signal }
      ).catch(() => null);

      if (!response?.ok) {
        setSlug(nextSlug);
        return;
      }

      const body = (await response.json()) as { slug?: string };
      setSlug(body.slug ?? nextSlug);
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [name, slugEdited]);

  async function createTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage(null);

    const response = await fetch("/api/onboarding/team", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        slug: normalizeTeamSlug(slug || name),
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus("error");
      setMessage(body?.error ?? "Could not create team.");
      return;
    }

    window.location.assign("/admin/team");
  }

  async function acceptInvite(inviteId: string) {
    setAcceptingInviteId(inviteId);
    setMessage(null);

    const response = await fetch(`/api/onboarding/invitations/${inviteId}/accept`, {
      method: "POST",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setAcceptingInviteId(null);
      setMessage(body?.error ?? "Could not accept invitation.");
      return;
    }

    window.location.assign("/admin/team");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <section className="space-y-4 rounded-lg border border-border bg-card p-5 text-card-foreground">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-base font-semibold">Pending invitations</h2>
        </div>

        {invites.length > 0 ? (
          <div className="divide-y divide-border">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{invite.teamName}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.teamSlug} · {invite.role}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void acceptInvite(invite.id)}
                  disabled={acceptingInviteId === invite.id}
                >
                  <Check aria-hidden="true" />
                  {acceptingInviteId === invite.id ? "Accepting" : "Accept"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No pending invitations for this email.</p>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-5 text-card-foreground">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-base font-semibold">Create a new team</h2>
        </div>

        <form onSubmit={createTeam} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="team-name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="team-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slugEdited) {
                  setSlug(normalizeTeamSlug(event.target.value));
                }
              }}
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="team-slug" className="text-sm font-medium">
              Slug
            </label>
            <input
              id="team-slug"
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(normalizeTeamSlug(event.target.value));
              }}
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 font-mono text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
            />
          </div>

          <Button type="submit" disabled={status === "submitting"} className="w-full">
            <Building2 aria-hidden="true" />
            {status === "submitting" ? "Creating" : "Create team"}
          </Button>
        </form>

        {message ? (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
