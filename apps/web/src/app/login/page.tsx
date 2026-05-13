import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const nextPath = normalizeNextPath(next);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Second Brain admin</p>
      </header>

      <LoginForm nextPath={nextPath} />
    </main>
  );
}

function normalizeNextPath(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;

  if (!next?.startsWith("/") || next.startsWith("//")) {
    return "/admin/team";
  }

  return next;
}
