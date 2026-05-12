import { LogOut, Mail } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  sendInviteMagicLink,
  signOutForInvite,
} from "@/app/invite/[token]/actions";
import { Button } from "@/components/ui/button";
import { HttpError } from "@/lib/http/errors";
import { acceptInvitationToken } from "@/lib/invitations/accept";
import { getInvitationPreview } from "@/lib/invitations/preview";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface InvitePageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    sent?: string;
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
      await acceptInvitationToken(token, user.id);
      redirect("/admin/team?invite=accepted");
    } catch (error) {
      if (error instanceof HttpError && error.status === 410) {
        return <InviteGone />;
      }

      if (error instanceof HttpError && error.status === 403) {
        return (
          <InviteShell
            title="Use the invited email"
            subtitle={`You are signed in as ${
              user.email ?? "another account"
            }. This invite was sent to ${preview.email}.`}
          >
            <form
              action={signOutForInvite}
              className="rounded-lg border border-border bg-card p-5"
            >
              <input type="hidden" name="token" value={token} />
              <Button className="w-full" type="submit" variant="secondary">
                <LogOut aria-hidden="true" />
                Sign out
              </Button>
            </form>
          </InviteShell>
        );
      }

      throw error;
    }
  }

  return (
    <InviteShell
      title={`Join ${preview.teamName}`}
      subtitle={`${preview.inviterName} invited you as ${preview.role}.`}
    >
      <form
        action={sendInviteMagicLink}
        className="space-y-4 rounded-lg border border-border bg-card p-5"
      >
        <input type="hidden" name="token" value={token} />
        <label className="block space-y-2 text-sm">
          <span className="font-medium">Email</span>
          <input
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus-visible:ring-1 focus-visible:ring-ring"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={preview.email}
            required
          />
        </label>
        <Button className="w-full" type="submit">
          <Mail aria-hidden="true" />
          Continue
        </Button>
      </form>

      {query.sent === "1" ? (
        <p className="rounded-md border border-border bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          Check your email to finish joining.
        </p>
      ) : null}

      {query.signed_out === "1" ? (
        <p className="rounded-md border border-border bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          Continue with the invited email.
        </p>
      ) : null}

      {query.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          Unable to send that link. Try again.
        </p>
      ) : null}
    </InviteShell>
  );
}

function InviteGone() {
  return (
    <InviteShell
      title="Invite unavailable"
      subtitle="This invitation has expired or was already used."
    />
  );
}

function InviteShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Second Brain</p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </header>
      {children}
    </main>
  );
}
