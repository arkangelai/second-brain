import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const grainSvg =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.9  0 0 0 0 0.7  0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export function ArchiveBackdrop({
  variant = "centered",
}: {
  variant?: "centered" | "spread";
}) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.07] mix-blend-screen"
        style={{ backgroundImage: grainSvg, backgroundSize: "220px 220px" }}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 -z-10 h-[70vh]",
          variant === "centered"
            ? "bg-[radial-gradient(ellipse_at_50%_-10%,_rgba(45,212,191,0.18),_transparent_45%),radial-gradient(ellipse_at_85%_8%,_rgba(251,191,36,0.12),_transparent_50%)]"
            : "bg-[radial-gradient(ellipse_at_18%_8%,_rgba(45,212,191,0.16),_transparent_42%),radial-gradient(ellipse_at_78%_4%,_rgba(251,191,36,0.14),_transparent_45%)]"
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 [background-image:linear-gradient(to_right,rgba(255,255,255,0.022)_1px,transparent_1px)] [background-size:96px_100%]"
      />
    </>
  );
}

export function ArchivePage({
  children,
  backdrop = "centered",
  className,
}: {
  children: ReactNode;
  backdrop?: "centered" | "spread";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate min-h-dvh overflow-hidden bg-[#0b0f0d] text-stone-200 antialiased",
        className
      )}
    >
      <ArchiveBackdrop variant={backdrop} />
      {children}
    </div>
  );
}

export function ArchiveEyebrow({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "teal" | "amber" | "muted";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.3em]",
        tone === "default" && "text-stone-400",
        tone === "muted" && "text-stone-500",
        tone === "teal" && "text-teal-200/80",
        tone === "amber" && "text-amber-200/85",
        className
      )}
    >
      {children}
    </span>
  );
}

export function ArchiveDisplay({
  children,
  size = "lg",
  className,
  as: Component = "h1",
}: {
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  as?: "h1" | "h2" | "h3" | "p";
}) {
  const sizeClass =
    size === "xl"
      ? "text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[0.98]"
      : size === "lg"
        ? "text-[clamp(2rem,3.5vw,3rem)] leading-[1.02]"
        : size === "md"
          ? "text-[1.75rem] leading-[1.1]"
          : "text-[1.35rem] leading-[1.15]";

  const opsz = size === "xl" ? 96 : size === "lg" ? 64 : size === "md" ? 48 : 36;

  return (
    <Component
      className={cn(
        "font-[family-name:var(--font-fraunces)] font-light tracking-tight text-stone-100",
        sizeClass,
        className
      )}
      style={{ fontVariationSettings: `'opsz' ${opsz}, 'SOFT' 30` }}
    >
      {children}
    </Component>
  );
}

export function ArchiveCard({
  children,
  index,
  kind,
  rotate = 0,
  className,
}: {
  children: ReactNode;
  index?: string;
  kind?: string;
  rotate?: number;
  className?: string;
}) {
  const rotation =
    rotate === 0 ? undefined : { transform: `rotate(${rotate}deg)` };

  return (
    <div
      style={rotation}
      className={cn(
        "relative rounded-md border border-stone-800/80 bg-stone-950/70 p-6 shadow-2xl shadow-black/40 backdrop-blur transition-transform hover:rotate-0 sm:p-7",
        className
      )}
    >
      {(index || kind) && (
        <div className="mb-5 flex items-center justify-between border-b border-dashed border-stone-800/80 pb-3 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.25em] text-stone-500">
          <span>{index ?? "Card / 0000"}</span>
          {kind ? <span className="text-teal-200/80">{kind}</span> : null}
        </div>
      )}
      {children}
    </div>
  );
}

export function ArchiveBrandStrip({
  caption,
  right,
}: {
  caption?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-800/70 pb-6 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.24em] text-stone-500">
      <span className="flex items-center gap-3">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-300/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-300" />
        </span>
        <span className="text-stone-300">Second Brain</span>
        <span className="text-stone-700">/</span>
        <span>{caption ?? "Archive 001"}</span>
      </span>
      {right}
    </header>
  );
}
