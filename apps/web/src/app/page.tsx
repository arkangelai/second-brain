import Link from "next/link";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import { ArrowRight, BrainCircuit, GitBranch, ShieldCheck } from "lucide-react";
import { NoteKindSchema } from "@second-brain/shared";

import { Button } from "@/components/ui/button";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const pillars = [
  {
    index: "01",
    title: "Capture without ceremony",
    body: "Notes, books, MOCs, pipeline posts - every thought has a home. Markdown stays on your disk; the database is just a faithful reflection of it.",
  },
  {
    index: "02",
    title: "Linked the way you actually think",
    body: "Backlinks, kinds, and tags compose into a graph your future self can traverse. No vendor lock-in. No syncing tax. No flat feed.",
  },
  {
    index: "03",
    title: "Agents that read your work",
    body: "Local-first by default, AI-native by design. Plug in an agent and let it reason over your archive, not someone else's training data.",
  },
];

const audiences = [
  [
    "Builders & researchers",
    "who need a private corpus to think alongside, not a public stream to perform on.",
  ],
  [
    "Writers & operators",
    "who keep MOCs, reading notes and pipelines and want them to compound over years, not weeks.",
  ],
  [
    "Teams that own their data",
    "and want agents that read it, with no copy leaving the disk by default.",
  ],
] as const;

const grainSvg =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.9  0 0 0 0 0.7  0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const proofPoints = [
  { label: "Private graph", value: "local", icon: GitBranch },
  { label: "Agent ready", value: "scoped", icon: BrainCircuit },
  { label: "Data boundary", value: "owned", icon: ShieldCheck },
] as const;

export default function Home() {
  const supportedKinds = NoteKindSchema.options;

  return (
    <div
      className={`${fraunces.variable} ${plexMono.variable} relative isolate min-h-dvh overflow-hidden bg-[#0b0f0d] text-stone-200 antialiased`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-screen"
        style={{ backgroundImage: grainSvg, backgroundSize: "220px 220px" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] bg-[radial-gradient(ellipse_at_18%_8%,_rgba(45,212,191,0.16),_transparent_42%),radial-gradient(ellipse_at_78%_4%,_rgba(251,191,36,0.14),_transparent_45%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:96px_100%]"
      />

      <main className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-6 py-8 sm:px-10 sm:py-10">
        <header className="flex items-center justify-between border-b border-stone-800/70 pb-6 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.24em] text-stone-500">
          <span className="flex items-center gap-3">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-300/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-300" />
            </span>
            <span>Second Brain</span>
            <span className="text-stone-700">/</span>
            <span>Archive 001</span>
          </span>
          <span className="hidden sm:inline">Est. 2026 / Local-first</span>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-stone-300 transition-colors hover:text-teal-100"
          >
            Sign in
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </header>

        <section className="grid grid-cols-1 gap-12 pt-20 md:grid-cols-12 md:gap-10 md:pt-28">
          <div className="motion-safe:animate-[reveal-up_900ms_cubic-bezier(0.22,1,0.36,1)_both] md:col-span-8">
            <p className="mb-8 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.3em] text-teal-200/80">
              Private knowledge system
            </p>
            <h1
              className="font-[family-name:var(--font-fraunces)] text-[clamp(3rem,7.5vw,6.75rem)] font-light leading-[0.95] tracking-normal text-stone-100"
              style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 30" }}
            >
              Your{" "}
              <em className="font-normal italic text-amber-200/95">second</em>
              <br />
              brain, finally
              <br />
              <span className="italic text-stone-300">on your side.</span>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-stone-400 sm:text-lg">
              Second Brain is a local-first, AI-native workspace for the notes,
              books, MOCs and pipelines you&apos;ve been collecting for years.
              Your archive stays on your disk. Agents come to you, not the
              other way around.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-5">
              <Button
                asChild
                size="lg"
                className="group h-12 rounded-full bg-amber-200 px-7 text-[15px] font-medium text-stone-950 shadow-[0_0_0_1px_rgba(252,211,77,0.4),0_20px_60px_-20px_rgba(252,211,77,0.6)] transition-all hover:bg-amber-100 hover:shadow-[0_0_0_1px_rgba(252,211,77,0.6),0_30px_80px_-20px_rgba(252,211,77,0.8)]"
              >
                <Link href="/login">
                  Enter the archive
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </Link>
              </Button>
              <Link
                href="/login"
                className="text-sm text-stone-400 underline decoration-stone-700 underline-offset-[6px] transition hover:text-stone-100 hover:decoration-amber-300"
              >
                Already have an account? Sign in
              </Link>
            </div>
          </div>

          <aside className="motion-safe:animate-[reveal-up_900ms_180ms_cubic-bezier(0.22,1,0.36,1)_both] md:col-span-4">
            <div className="rotate-[0.4deg] rounded-md border border-stone-800/80 bg-stone-950/60 p-6 shadow-2xl shadow-black/40 backdrop-blur transition-transform hover:rotate-0">
              <div className="mb-5 flex items-center justify-between border-b border-dashed border-stone-800/80 pb-3 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.25em] text-stone-500">
                <span>Card / 0001</span>
                <span className="text-teal-200/80">note</span>
              </div>
              <p
                className="font-[family-name:var(--font-fraunces)] text-[1.65rem] leading-[1.15] text-stone-100"
                style={{ fontVariationSettings: "'opsz' 72" }}
              >
                &ldquo;A note you keep is a thought you can lend yourself
                later.&rdquo;
              </p>
              <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 font-[family-name:var(--font-plex-mono)] text-[12px]">
                <dt className="text-stone-500">path</dt>
                <dd className="truncate text-stone-300">
                  01_thinking/hello.md
                </dd>
                <dt className="text-stone-500">kinds</dt>
                <dd className="text-stone-300">
                  {supportedKinds.join(" / ")}
                </dd>
                <dt className="text-stone-500">backlinks</dt>
                <dd className="text-stone-300">3</dd>
              </dl>
              <div className="mt-6 grid grid-cols-3 gap-2 border-t border-stone-800/80 pt-4">
                {proofPoints.map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="rounded-sm border border-stone-800/80 bg-stone-900/60 p-3"
                  >
                    <Icon
                      className="mb-3 size-4 text-cyan-200/80"
                      aria-hidden
                    />
                    <p className="font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.16em] text-stone-500">
                      {label}
                    </p>
                    <p className="mt-1 font-[family-name:var(--font-plex-mono)] text-[11px] text-stone-200">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-28 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-stone-800/80 bg-stone-800/70 md:grid-cols-3">
          {pillars.map((pillar) => (
            <article
              key={pillar.index}
              className="group relative bg-[#0b0f0d] p-8 transition-colors duration-300 hover:bg-stone-950"
            >
              <div className="flex items-center gap-3 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.3em] text-teal-200/70">
                <span className="text-stone-100">{pillar.index}</span>
                <span className="h-px w-6 bg-stone-700 transition-all duration-500 group-hover:w-12 group-hover:bg-amber-300/70" />
                <span>pillar</span>
              </div>
              <h2
                className="mt-5 font-[family-name:var(--font-fraunces)] text-[1.6rem] leading-[1.1] text-stone-100"
                style={{ fontVariationSettings: "'opsz' 36" }}
              >
                {pillar.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-400">
                {pillar.body}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-28 grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <span className="font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.3em] text-stone-500">
              For whom
            </span>
            <p
              className="mt-4 font-[family-name:var(--font-fraunces)] text-3xl leading-tight text-stone-100"
              style={{ fontVariationSettings: "'opsz' 48" }}
            >
              Built for the kind of person who keeps a notebook.
            </p>
          </div>
          <ul className="divide-y divide-stone-800/80 md:col-span-8">
            {audiences.map(([who, why]) => (
              <li
                key={who}
                className="flex flex-col gap-1 py-6 md:flex-row md:items-baseline md:gap-10"
              >
                <span
                  className="min-w-[14rem] font-[family-name:var(--font-fraunces)] text-xl text-stone-100"
                  style={{ fontVariationSettings: "'opsz' 24" }}
                >
                  {who}
                </span>
                <span className="text-[15px] leading-relaxed text-stone-400">
                  {why}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-28 flex flex-col items-start justify-between gap-8 rounded-md border border-teal-200/15 bg-gradient-to-br from-teal-200/[0.08] via-amber-200/[0.04] to-transparent p-10 md:flex-row md:items-center">
          <div className="max-w-xl">
            <span className="font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.3em] text-teal-200/80">
              Begin
            </span>
            <h3
              className="mt-3 font-[family-name:var(--font-fraunces)] text-[2.25rem] leading-[1.05] text-stone-100"
              style={{ fontVariationSettings: "'opsz' 64" }}
            >
              The archive is empty until you arrive.
            </h3>
            <p className="mt-3 text-sm text-stone-400">
              Sign in to claim a workspace and start linking thoughts that
              finally stay yours.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="group h-12 rounded-full bg-amber-200 px-7 text-[15px] font-medium text-stone-950 shadow-[0_20px_60px_-20px_rgba(252,211,77,0.6)] transition-all hover:bg-amber-100"
          >
            <Link href="/login">
              Sign in to Second Brain
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
          </Button>
        </section>

        <footer className="mt-20 flex flex-col gap-2 border-t border-stone-800/70 pt-6 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.25em] text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <span>(c) 2026 Second Brain / Local-first by default</span>
          <span>
            v0.1 / {supportedKinds.length} kinds / {pillars.length} pillars
          </span>
        </footer>
      </main>
    </div>
  );
}
