"use client";

import { type FormEvent, useMemo, useState } from "react";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type LoginFormProps = {
  nextPath: string;
  initialEmail?: string;
};

export function LoginForm({ nextPath, initialEmail = "" }: LoginFormProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [status, setStatus] = useState<
    "idle" | "sending" | "verifying" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStep("code");
    setStatus("idle");
    setMessage(`Code dispatched to ${normalizedEmail}. Check your inbox.`);
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("verifying");
    setMessage("");

    const emailAddress = email.trim().toLowerCase();
    const token = normalizeOtpCode(code);
    setCode(token);

    if (token.length < 6) {
      setStatus("error");
      setMessage("Enter the code from the newest email.");
      return;
    }

    const { error } = await supabase.auth.verifyOtp({
      email: emailAddress,
      token,
      type: "email",
    });

    if (error) {
      setStatus("error");
      setMessage(authErrorMessage(error));
      return;
    }

    window.location.assign(nextPath);
  }

  if (step === "code") {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-5">
        <FieldLabel htmlFor="code" caption={`Sent to ${maskEmail(email)}`}>
          Verification code
        </FieldLabel>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          autoFocus
          value={code}
          onChange={(event) => setCode(normalizeOtpCode(event.target.value))}
          placeholder="000000"
          className="h-12 w-full rounded-md border border-stone-800/80 bg-stone-950/70 px-4 text-center font-[family-name:var(--font-plex-mono)] text-lg tracking-[0.5em] text-stone-100 outline-none transition focus:border-amber-200/70 focus:ring-1 focus:ring-amber-200/40"
        />

        <PrimaryButton
          type="submit"
          loading={status === "verifying"}
          loadingText="Verifying"
          icon={<KeyRound aria-hidden="true" className="size-4" />}
        >
          Verify and enter
        </PrimaryButton>

        <button
          type="button"
          className="group inline-flex w-full items-center justify-center gap-2 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.28em] text-stone-500 transition-colors hover:text-stone-200"
          onClick={() => {
            setStep("email");
            setCode("");
            setStatus("idle");
            setMessage("");
          }}
        >
          <ArrowLeft
            aria-hidden="true"
            className="size-3.5 transition-transform group-hover:-translate-x-0.5"
          />
          Use a different email
        </button>

        <StatusMessage status={status} message={message} />
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="space-y-5">
      <FieldLabel htmlFor="email">Email</FieldLabel>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="h-12 w-full rounded-md border border-stone-800/80 bg-stone-950/70 px-4 font-[family-name:var(--font-plex-mono)] text-sm text-stone-100 placeholder:text-stone-600 outline-none transition focus:border-amber-200/70 focus:ring-1 focus:ring-amber-200/40"
      />

      <PrimaryButton
        type="submit"
        loading={status === "sending"}
        loadingText="Sending"
        icon={<Mail aria-hidden="true" className="size-4" />}
      >
        Send the code
      </PrimaryButton>

      <StatusMessage status={status} message={message} />
    </form>
  );
}

function FieldLabel({
  htmlFor,
  caption,
  children,
}: {
  htmlFor: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <label
        htmlFor={htmlFor}
        className="font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.28em] text-stone-400"
      >
        {children}
      </label>
      {caption ? (
        <span className="truncate font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.2em] text-stone-600">
          {caption}
        </span>
      ) : null}
    </div>
  );
}

function PrimaryButton({
  children,
  type = "button",
  loading = false,
  loadingText,
  icon,
}: {
  children: React.ReactNode;
  type?: "button" | "submit";
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type={type}
      disabled={loading}
      className={cn(
        "group inline-flex h-12 w-full items-center justify-center gap-2 rounded-md px-5 text-[14px] font-medium transition-all",
        "bg-amber-200 text-stone-950 shadow-[0_0_0_1px_rgba(252,211,77,0.35),0_18px_50px_-20px_rgba(252,211,77,0.55)] hover:bg-amber-100 hover:shadow-[0_0_0_1px_rgba(252,211,77,0.55),0_28px_70px_-20px_rgba(252,211,77,0.75)]",
        "disabled:cursor-not-allowed disabled:bg-amber-200/70 disabled:shadow-none"
      )}
    >
      {icon}
      <span>{loading ? (loadingText ?? "Working") : children}</span>
    </button>
  );
}

function StatusMessage({
  status,
  message,
}: {
  status: "idle" | "sending" | "verifying" | "error";
  message: string;
}) {
  if (!message) return null;

  const tone =
    status === "error"
      ? "border-red-400/30 bg-red-500/10 text-red-200"
      : "border-stone-700/70 bg-stone-900/60 text-stone-300";

  return (
    <p
      className={cn(
        "rounded-md border px-3 py-2 text-[13px] leading-relaxed",
        tone
      )}
      role="status"
    >
      {message}
    </p>
  );
}

function maskEmail(email: string) {
  const trimmed = email.trim();
  const [name, domain] = trimmed.split("@");
  if (!name || !domain) return trimmed;
  if (name.length <= 2) return `${name[0] ?? ""}*@${domain}`;
  return `${name[0]}${"*".repeat(Math.max(1, name.length - 2))}${name[name.length - 1]}@${domain}`;
}

function normalizeOtpCode(value: string) {
  return value.replace(/\D/g, "");
}

function authErrorMessage(error: { message: string; code?: string }) {
  if (error.code === "otp_expired" || /expired|invalid/i.test(error.message)) {
    return "That code was rejected. Request a new one, then enter the full code from the newest email.";
  }

  return error.message;
}
