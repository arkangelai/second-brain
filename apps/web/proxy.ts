import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  ACTIVE_TEAM_COOKIE,
  getDefaultTeamId,
  getHumanMemberships,
  resolveActiveTeamId,
  setActiveTeamCookie,
} from "@/lib/auth/active-team";
import { requireEnv } from "@/lib/env";

const PUBLIC_AUTH_PATHS = ["/login", "/auth/callback"];

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user) {
    if (pathname.startsWith("/admin")) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  const memberships = await getHumanMemberships(supabase, user.id);

  if (memberships.length === 0) {
    if (pathname !== "/onboarding" && !PUBLIC_AUTH_PATHS.includes(pathname)) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    return response;
  }

  const defaultTeamId = await getDefaultTeamId(supabase, user.id);
  const activeTeamId = resolveActiveTeamId(
    memberships,
    request.cookies.get(ACTIVE_TEAM_COOKIE)?.value,
    defaultTeamId
  );

  if (activeTeamId) {
    setActiveTeamCookie(response, activeTeamId);
  }

  if (pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/admin/team", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
