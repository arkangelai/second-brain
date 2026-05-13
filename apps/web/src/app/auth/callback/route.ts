import { createServerSupabaseClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = normalizeNextPath(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
    }
  }

  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("next", nextPath);
  loginUrl.searchParams.set("error", "auth_callback_failed");

  return NextResponse.redirect(loginUrl);
}

function normalizeNextPath(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return "/admin/team";
  }

  return value;
}
