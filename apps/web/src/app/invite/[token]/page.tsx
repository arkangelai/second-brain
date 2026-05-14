import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { signOutForInvite } from "@/app/invite/[token]/actions";
import { LoginForm } from "@/app/login/login-form";
import {
  ArchiveBrandStrip,
  ArchiveCard,
  ArchiveDisplay,
  ArchiveEyebrow,
  ArchivePage,
} from "@/components/archive/archive-shell";
import { HttpError } from "@/lib/http/errors";
import { acceptInvitationToken } from "@/lib/invitations/accept";
import { getInvitationPreview } from "@/lib/invitations/preview";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface InvitePageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    error?: string;
    signed_out?: string;
  }>;
}

export default async function InvitePage({
  params,
  searchParams,
}: InvitePageProps) {
  const { token } = await params;
  const query = await searchParams;
  const preview = await getInvitationPreview(token);

  if (preview.status === "gone") {
    return <InviteGone />;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      const result = await acceptInvitationToken(token, user.id);
      const teamParam = result.team_id
        ? `&team=${encodeURIComponent(result.team_id)}`
        : "";

      redirect(`/admin/team?invite=accepted${teamParam}`);
    } catch (error) {
      if (error instanceof HttpError && error.status === 410) {
        return <InviteGone />;
      }

      if (error instanceof HttpError && error.status === 403) {
        return (
          <InviteShell
            eyebrow="Wrong custodian"
            title="Use the invited email"
            subtitle={`You are signed in as ${
              user.email ?? "another account"
            }. This invite was sent to ${preview.email}.`}
            kind="redirect"
          >
            <form action={signOutForInvite}>
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-stone-700/80 bg-stone-950/60 px-5 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.28em] text-stone-200 transition hover:border-amber-200/60 hover:text-amber-100"
              >
                <LogOut aria-hidden="true" className="size-3.5" />
                Sign out
              </button>
            </form>
          </InviteShell>
        );
      }

      throw error;
    }
  }

  return (
    <InviteShell
      eyebrow={`Invited as ${preview.role}`}
      title={
        <>
          Join{" "}
          <em className="font-normal italic text-amber-200/95">
            {preview.teamName}
          </em>
        </>
      }
      subtitle={`${preview.inviterName} reserved a seat for you. The code we send is bound to the email this invitation was issued to.`}
      kind="invite"
      meta={[
        { label: "team", value: preview.teamName },
        { label: "role", value: preview.role },
        { label: "for", value: preview.email },
      ]}
    >
      <LoginForm
        nextPath={`/invite/${encodeURIComponent(token)}`}
        initialEmail={preview.email}
      />

      {query.signed_out === "1" ? (
        <p className="mt-5 rounded-md border border-stone-700/70 bg-stone-900/60 px-3 py-2 text-sm text-stone-300">
          Continue with the invited email.
        </p>
      ) : null}

      {query.error ? (
        <p className="mt-5 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          Unable to continue. Try again.
        </p>
      ) : null}
    </InviteShell>
  );
}

function InviteGone() {
  return (
    <InviteShell
      eyebrow="Card / expired"
      title="Invite unavailable"
      subtitle="This invitation has expired or was already used."
      kind="expired"
    />
  );
}

function InviteShell({
  eyebrow,
  title,
  subtitle,
  children,
  kind,
  meta,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  children?: ReactNode;
  kind: "invite" | "redirect" | "expired";
  meta?: Array<{ label: string; value: string }>;
}) {
  return (
    <ArchivePage backdrop="centered">
      <main className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 py-8 sm:px-10 sm:py-10">
        <ArchiveBrandStrip caption={`Gate / Invitation`} />

        <div className="mt-16 grid flex-1 items-center gap-12 md:mt-24 md:grid-cols-12">
          <section className="motion-safe:animate-[reveal-up_900ms_cubic-bezier(0.22,1,0.36,1)_both] md:col-span-6">
            <ArchiveEyebrow tone="teal" className="mb-7">
              {eyebrow}
            </ArchiveEyebrow>
            <ArchiveDisplay size="lg">{title}</ArchiveDisplay>
            <p className="mt-6 max-w-md text-base leading-relaxed text-stone-400">
              {subtitle}
            </p>

            {meta ? (
              <dl className="mt-10 grid max-w-md grid-cols-1 gap-4 border-t border-stone-800/80 pt-6 sm:grid-cols-3">
                {meta.map(({ label, value }) => (
                  <div key={label}>
                    <dt className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-stone-500">
                      {label}
                    </dt>
                    <dd className="mt-1 truncate text-sm text-stone-200">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>

          <section className="motion-safe:animate-[reveal-up_900ms_180ms_cubic-bezier(0.22,1,0.36,1)_both] md:col-span-6">
            <ArchiveCard
              index={
                kind === "expired"
                  ? "Card / void"
                  : kind === "redirect"
                    ? "Card / 0204"
                    : "Card / 0203"
              }
              kind={kind === "expired" ? "expired" : "invite"}
              rotate={kind === "expired" ? 0.2 : -0.4}
              className="hover:rotate-0"
            >
              {kind === "expired" ? (
                <div className="flex flex-col items-start gap-4">
                  <ArchiveEyebrow tone="amber">Status</ArchiveEyebrow>
                  <p
                    className="font-[family-name:var(--font-fraunces)] text-[1.7rem] leading-[1.1] text-stone-100"
                    style={{ fontVariationSettings: "'opsz' 48" }}
                  >
                    The seal was already broken — or its window has closed.
                  </p>
                  <p className="text-sm leading-relaxed text-stone-400">
                    Ask the inviter to issue a fresh link from the team admin.
                  </p>
                </div>
              ) : (
                children
              )}
            </ArchiveCard>
          </section>
        </div>

        <footer className="mt-20 flex flex-col gap-2 border-t border-stone-800/70 pt-6 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.25em] text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <span>(c) 2026 Second Brain / Local-first by default</span>
          <span>Invitation routine v1</span>
        </footer>
      </main>
    </ArchivePage>
  );
}
