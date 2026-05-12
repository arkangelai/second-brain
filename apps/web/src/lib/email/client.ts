import type { ReactNode } from "react";
import { Resend } from "resend";
import { requiresResendApiKey, serverEnv } from "@second-brain/shared/env";

interface SendEmailInput {
  to: string | string[];
  subject: string;
  react: ReactNode;
  text?: string;
  replyTo?: string | string[];
  devLink?: string;
}

interface SendEmailResult {
  id: string | null;
  dev: boolean;
}

let resend: Resend | null = null;

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!serverEnv.RESEND_API_KEY) {
    if (requiresResendApiKey(serverEnv)) {
      throw new Error("RESEND_API_KEY must be set for production email delivery");
    }

    console.info("[email:dev]", {
      to: input.to,
      from: serverEnv.EMAIL_FROM,
      replyTo: input.replyTo ?? serverEnv.EMAIL_REPLY_TO,
      subject: input.subject,
      link: input.devLink,
      text: input.text,
    });
    return { id: null, dev: true };
  }

  resend ??= new Resend(serverEnv.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: serverEnv.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    react: input.react,
    text: input.text,
    replyTo: input.replyTo ?? serverEnv.EMAIL_REPLY_TO,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { id: data?.id ?? null, dev: false };
}
