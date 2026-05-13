"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { appUrl, safeRedirectPath } from "@/lib/url";

export async function sendLoginMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeRedirectPath(String(formData.get("next") ?? "/admin/team"));

  if (!email) {
    redirect(`/login?next=${encodeURIComponent(next)}&error=email`);
  }

  const callbackUrl = new URL("/auth/callback", appUrl());
  callbackUrl.searchParams.set("next", next);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error(error);
    redirect(`/login?next=${encodeURIComponent(next)}&error=magic-link`);
  }

  redirect(`/login?next=${encodeURIComponent(next)}&sent=1`);
}
