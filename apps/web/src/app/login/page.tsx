import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { LoginForm } from "./login-form";
import {
  ArchiveBrandStrip,
  ArchiveCard,
  ArchiveDisplay,
  ArchiveEyebrow,
  ArchivePage,
} from "@/components/archive/archive-shell";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const nextPath = normalizeNextPath(next);

  return (
    <ArchivePage backdrop="centered">
      <main className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-8 sm:px-10 sm:py-10">
        <ArchiveBrandStrip
          caption="Gate / Sign in"
          right={
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-stone-400 transition-colors hover:text-teal-100"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to archive
            </Link>
          }
        />

        <div className="mt-16 grid flex-1 grid-cols-1 items-center gap-14 md:mt-24 md:grid-cols-12">
          <section className="motion-safe:animate-[reveal-up_900ms_cubic-bezier(0.22,1,0.36,1)_both] md:col-span-7">
            <ArchiveEyebrow tone="teal" className="mb-7">
              Returning custodian
            </ArchiveEyebrow>
            <ArchiveDisplay size="xl">
              Step back{" "}
              <em className="font-normal italic text-amber-200/95">inside</em>
              <br />
              your archive.
            </ArchiveDisplay>
            <p className="mt-7 max-w-md text-base leading-relaxed text-stone-400">
              We&apos;ll mail a one-time code to the address you keep notes
              under. No passwords to remember, no third-party SSO drifting
              between sessions.
            </p>
            <ul className="mt-10 grid max-w-md grid-cols-1 gap-3 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.22em] text-stone-500 sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-teal-300/80" /> Local
                first
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-amber-200/80" />{" "}
                Single-use code
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-stone-400/70" /> No
                third-party tracking
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-stone-400/70" /> Cookie
                bound to device
              </li>
            </ul>
          </section>

          <section className="motion-safe:animate-[reveal-up_900ms_180ms_cubic-bezier(0.22,1,0.36,1)_both] md:col-span-5">
            <ArchiveCard
              index="Gate / 0002"
              kind="auth"
              rotate={-0.4}
              className="hover:rotate-0"
            >
              <ArchiveEyebrow tone="muted" className="mb-3">
                Identity check
              </ArchiveEyebrow>
              <h1
                className="font-[family-name:var(--font-fraunces)] text-[1.85rem] leading-[1.1] text-stone-100"
                style={{ fontVariationSettings: "'opsz' 48" }}
              >
                Sign in to Second Brain
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-stone-400">
                Use the code we send to your email. The newest code wins; older
                ones expire on arrival.
              </p>
              <div className="mt-7">
                <LoginForm nextPath={nextPath} />
              </div>
            </ArchiveCard>
          </section>
        </div>

        <footer className="mt-20 flex flex-col gap-2 border-t border-stone-800/70 pt-6 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.25em] text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <span>(c) 2026 Second Brain / Local-first by default</span>
          <span>Gate routine / one-time code</span>
        </footer>
      </main>
    </ArchivePage>
  );
}

function normalizeNextPath(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;

  if (!next?.startsWith("/") || next.startsWith("//")) {
    return "/admin/team";
  }

  return next;
}
