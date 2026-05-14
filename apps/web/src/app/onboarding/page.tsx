import { redirect } from "next/navigation";

import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import {
  ArchiveBrandStrip,
  ArchiveDisplay,
  ArchiveEyebrow,
  ArchivePage,
} from "@/components/archive/archive-shell";
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
    <ArchivePage backdrop="spread">
      <main className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-8 sm:px-10 sm:py-10">
        <ArchiveBrandStrip
          caption="Onboarding / Choose archive"
          right={
            <span className="text-stone-500">
              Signed in as{" "}
              <span className="text-stone-300">{user.email ?? "you"}</span>
            </span>
          }
        />

        <header className="mt-14 max-w-3xl motion-safe:animate-[reveal-up_900ms_cubic-bezier(0.22,1,0.36,1)_both] md:mt-20">
          <ArchiveEyebrow tone="teal" className="mb-7">
            Step 01 / claim a vault
          </ArchiveEyebrow>
          <ArchiveDisplay size="lg">
            One archive, or{" "}
            <em className="font-normal italic text-amber-200/95">many</em> — your
            graph starts here.
          </ArchiveDisplay>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-stone-400">
            Accept a pending invitation to join an existing team, or carve out
            your own brain. You can do both later; pick whichever feels right
            right now.
          </p>
        </header>

        <div className="mt-14 motion-safe:animate-[reveal-up_900ms_200ms_cubic-bezier(0.22,1,0.36,1)_both]">
          <OnboardingForm />
        </div>

        <footer className="mt-24 flex flex-col gap-2 border-t border-stone-800/70 pt-6 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.25em] text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <span>(c) 2026 Second Brain / Local-first by default</span>
          <span>Onboarding routine v1</span>
        </footer>
      </main>
    </ArchivePage>
  );
}
