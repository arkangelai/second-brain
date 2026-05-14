"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function signOutForInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");

  if (!token) {
    redirect("/");
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  redirect(`/invite/${encodeURIComponent(token)}?signed_out=1`);
}
