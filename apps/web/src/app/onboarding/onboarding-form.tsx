"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Building2, Check, Inbox, Users } from "lucide-react";

import { ArchiveCard, ArchiveEyebrow } from "@/components/archive/archive-shell";
import { normalizeTeamSlug } from "@/lib/onboarding/slug";
import { cn } from "@/lib/utils";

export type PendingInvite = {
  id: string;
  teamName: string;
  teamSlug: string;
  role: string;
};

type SubmitStatus = "idle" | "submitting" | "error";
type InviteStatus = "loading" | "ready" | "error";

export function OnboardingForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>("loading");
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(
    null
  );

  useEffect(() => {
    let active = true;

    void fetch("/api/onboarding/invitations")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load invitations.");
        }

        return (await response.json()) as { invites?: PendingInvite[] };
      })
      .then((body) => {
        if (!active) return;
        setInvites(body.invites ?? []);
        setInviteStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setInviteStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

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
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setStatus("error");
      setMessage(body?.error ?? "Could not create team.");
      return;
    }

    window.location.assign("/admin/team");
  }

  async function acceptInvite(inviteId: string) {
    setAcceptingInviteId(inviteId);
    setMessage(null);

    const response = await fetch(
      `/api/onboarding/invitations/${inviteId}/accept`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setAcceptingInviteId(null);
      setMessage(body?.error ?? "Could not accept invitation.");
      return;
    }

    window.location.assign("/admin/team");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
      <ArchiveCard index="Card / 0101" kind="invitations" className="hover:rotate-0">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md border border-stone-800 bg-stone-950/60 text-teal-200/80">
            <Inbox className="size-4" aria-hidden />
          </span>
          <div>
            <ArchiveEyebrow tone="muted">Pending invitations</ArchiveEyebrow>
            <h2 className="font-[family-name:var(--font-fraunces)] text-2xl leading-tight text-stone-100">
              Join a team
            </h2>
          </div>
        </div>

        <div className="mt-6">
          {inviteStatus === "loading" ? (
            <div className="flex h-32 items-center justify-center font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.28em] text-stone-500">
              <span className="inline-flex items-center gap-2">
                <span className="size-1.5 animate-pulse rounded-full bg-teal-300/80" />
                Loading invitations
              </span>
            </div>
          ) : inviteStatus === "error" ? (
            <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              Could not load invitations.
            </p>
          ) : invites.length > 0 ? (
            <ul className="divide-y divide-stone-800/80">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-stone-900/70 font-[family-name:var(--font-fraunces)] text-base text-amber-200/90">
                      {invite.teamName.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-[family-name:var(--font-fraunces)] text-lg leading-tight text-stone-100">
                        {invite.teamName}
                      </p>
                      <p className="mt-0.5 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.22em] text-stone-500">
                        {invite.teamSlug} / {invite.role}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void acceptInvite(invite.id)}
                    disabled={acceptingInviteId === invite.id}
                    className="group inline-flex h-9 items-center gap-2 rounded-md border border-teal-300/40 bg-teal-300/10 px-3 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.22em] text-teal-100 transition hover:border-teal-200/70 hover:bg-teal-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Check className="size-3.5" aria-hidden />
                    {acceptingInviteId === invite.id ? "Joining" : "Accept"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyInvites />
          )}
        </div>
      </ArchiveCard>

      <ArchiveCard
        index="Card / 0102"
        kind="new vault"
        rotate={0.4}
        className="hover:rotate-0"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md border border-stone-800 bg-stone-950/60 text-amber-200/85">
            <Building2 className="size-4" aria-hidden />
          </span>
          <div>
            <ArchiveEyebrow tone="muted">Found a new archive</ArchiveEyebrow>
            <h2 className="font-[family-name:var(--font-fraunces)] text-2xl leading-tight text-stone-100">
              Create a team
            </h2>
          </div>
        </div>

        <form onSubmit={createTeam} className="mt-6 space-y-5">
          <Field
            id="team-name"
            label="Team name"
            value={name}
            onChange={(value) => {
              setName(value);
              if (!slugEdited) {
                setSlug(normalizeTeamSlug(value));
              }
            }}
            placeholder="Atelier of the Mind"
            required
          />
          <Field
            id="team-slug"
            label="Slug"
            mono
            value={slug}
            onChange={(value) => {
              setSlugEdited(true);
              setSlug(normalizeTeamSlug(value));
            }}
            placeholder="atelier"
            caption="lowercase, dashes"
            required
          />

          <button
            type="submit"
            disabled={status === "submitting"}
            className={cn(
              "group inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-5 text-[14px] font-medium transition-all",
              "bg-amber-200 text-stone-950 shadow-[0_0_0_1px_rgba(252,211,77,0.35),0_18px_50px_-20px_rgba(252,211,77,0.55)] hover:bg-amber-100 hover:shadow-[0_0_0_1px_rgba(252,211,77,0.55),0_28px_70px_-20px_rgba(252,211,77,0.75)]",
              "disabled:cursor-not-allowed disabled:bg-amber-200/70 disabled:shadow-none"
            )}
          >
            {status === "submitting" ? "Carving" : "Create team"}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        </form>

        {message ? (
          <p
            className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            role="status"
          >
            {message}
          </p>
        ) : null}
      </ArchiveCard>
    </div>
  );
}

function EmptyInvites() {
  return (
    <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-stone-800/70 bg-stone-950/40 px-6 text-center">
      <Users className="size-5 text-stone-600" aria-hidden />
      <p className="text-sm text-stone-400">
        No pending invitations for this email.
      </p>
      <p className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-stone-600">
        Carve a new vault to begin
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  caption,
  mono = false,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  caption?: string;
  mono?: boolean;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.28em] text-stone-400"
        >
          {label}
        </label>
        {caption ? (
          <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.22em] text-stone-600">
            {caption}
          </span>
        ) : null}
      </div>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className={cn(
          "h-11 w-full rounded-md border border-stone-800/80 bg-stone-950/70 px-4 text-sm text-stone-100 placeholder:text-stone-600 outline-none transition focus:border-amber-200/70 focus:ring-1 focus:ring-amber-200/40",
          mono && "font-[family-name:var(--font-plex-mono)] tracking-wide"
        )}
      />
    </div>
  );
}
