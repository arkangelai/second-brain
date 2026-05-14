"use client";

import { type FormEvent, useMemo, useState } from "react";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

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
    setMessage(`Enter the 6-digit code sent to ${normalizedEmail}.`);
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("verifying");
    setMessage("");

    const emailAddress = email.trim().toLowerCase();
    const token = code.replace(/\D/g, "");

    const { error } = await supabase.auth.verifyOtp({
      email: emailAddress,
      token,
      type: "email",
    });

    if (error) {
      const legacyResult = await supabase.auth.verifyOtp({
        email: emailAddress,
        token,
        type: "magiclink",
      });

      if (legacyResult.error) {
        const signupResult = await supabase.auth.verifyOtp({
          email: emailAddress,
          token,
          type: "signup",
        });

        if (signupResult.error) {
          setStatus("error");
          setMessage(signupResult.error.message);
          return;
        }
      }
    }

    window.location.assign(nextPath);
  }

  if (step === "code") {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            maxLength={6}
          />
        </div>

        <Button
          type="submit"
          disabled={status === "verifying"}
          className="w-full"
        >
          <KeyRound aria-hidden="true" />
          {status === "verifying" ? "Verifying..." : "Verify code"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            setStep("email");
            setCode("");
            setStatus("idle");
            setMessage("");
          }}
        >
          <ArrowLeft aria-hidden="true" />
          Use a different email
        </Button>

        <StatusMessage status={status} message={message} />
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <Button type="submit" disabled={status === "sending"} className="w-full">
        <Mail aria-hidden="true" />
        {status === "sending" ? "Sending..." : "Send code"}
      </Button>

      <StatusMessage status={status} message={message} />
    </form>
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

  return (
    <p
      className={
        status === "error"
          ? "text-sm text-destructive"
          : "text-sm text-muted-foreground"
      }
      role="status"
    >
      {message}
    </p>
  );
}
