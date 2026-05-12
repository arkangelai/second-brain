import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { sendLoginMagicLink } from "@/app/login/actions";
import { safeRedirectPath } from "@/lib/url";

interface LoginPageProps {
  searchParams: Promise<{
    next?: string;
    sent?: string;
    error?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next);
  const sent = params.sent === "1";
  const hasError = Boolean(params.error);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Second Brain</p>
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      </header>

      <form
        action={sendLoginMagicLink}
        className="space-y-4 rounded-lg border border-border bg-card p-5"
      >
        <input type="hidden" name="next" value={next} />
        <label className="block space-y-2 text-sm">
          <span className="font-medium">Email</span>
          <input
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus-visible:ring-1 focus-visible:ring-ring"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <Button className="w-full" type="submit">
          <Mail aria-hidden="true" />
          Send magic link
        </Button>
      </form>

      {sent ? (
        <p className="rounded-md border border-border bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          Check your email for the sign-in link.
        </p>
      ) : null}

      {hasError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          Unable to send that link. Try again.
        </p>
      ) : null}
    </main>
  );
}
