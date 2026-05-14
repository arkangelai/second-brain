import { NextResponse, type NextRequest } from "next/server";

import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = normalizeNextPath(requestUrl.searchParams.get("next"));
  let withSupabaseResponseHeaders:
    | (<T extends Response>(response: T) => T)
    | undefined;

  if (code) {
    const { supabase, withSupabaseResponseHeaders: applySupabaseHeaders } =
      await createRouteHandlerSupabaseClient();
    withSupabaseResponseHeaders = applySupabaseHeaders;
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return withSupabaseResponseHeaders(
        NextResponse.redirect(new URL(nextPath, requestUrl.origin))
      );
    }
  }

  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("next", nextPath);
  loginUrl.searchParams.set("error", "auth_callback_failed");
  const response = NextResponse.redirect(loginUrl);

  return withSupabaseResponseHeaders
    ? withSupabaseResponseHeaders(response)
    : response;
}

function normalizeNextPath(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return "/admin/team";
  }

  return value;
}
