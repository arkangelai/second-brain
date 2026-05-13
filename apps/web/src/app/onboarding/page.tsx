import { redirect } from "next/navigation";

import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
        <p className="text-sm text-muted-foreground">
          Welcome. Create your team's brain or accept an invitation below.
        </p>
      </header>

      <OnboardingForm />
    </main>
  );
}
