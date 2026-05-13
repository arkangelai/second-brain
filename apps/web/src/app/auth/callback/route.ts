import { NextResponse, type NextRequest } from "next/server";

import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return "/admin/team";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));
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
        NextResponse.redirect(new URL(nextPath, request.url))
      );
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", nextPath);
  const response = NextResponse.redirect(loginUrl);
  return withSupabaseResponseHeaders
    ? withSupabaseResponseHeaders(response)
    : response;
}
