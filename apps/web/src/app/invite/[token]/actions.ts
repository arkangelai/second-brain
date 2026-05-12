"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/url";

export async function sendInviteMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "");

  if (!email || !token) {
    redirect(`/invite/${encodeURIComponent(token)}?error=email`);
  }

  const next = `/invite/${token}`;
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
    redirect(`/invite/${encodeURIComponent(token)}?error=magic-link`);
  }

  redirect(`/invite/${encodeURIComponent(token)}?sent=1`);
}

export async function signOutForInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");

  if (!token) {
    redirect("/");
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  redirect(`/invite/${encodeURIComponent(token)}?signed_out=1`);
}
