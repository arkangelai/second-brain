"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/url";

export async function sendLoginCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeRedirectPath(String(formData.get("next") ?? "/admin/team"));

  if (!email) {
    redirect(`/login?next=${encodeURIComponent(next)}&error=email`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error(error);
    redirect(`/login?next=${encodeURIComponent(next)}&error=code`);
  }

  redirect(`/login?next=${encodeURIComponent(next)}&sent=1`);
}
