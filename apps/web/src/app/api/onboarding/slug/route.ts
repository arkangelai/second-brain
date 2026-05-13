import { NextResponse, type NextRequest } from "next/server";

import { findAvailableTeamSlug } from "@/lib/onboarding/slug";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { supabase, withSupabaseResponseHeaders } =
    await createRouteHandlerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withSupabaseResponseHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
  }

  const value = request.nextUrl.searchParams.get("value") ?? "";
  const admin = createAdminSupabaseClient();
  const slug = await findAvailableTeamSlug(admin, value);

  return withSupabaseResponseHeaders(NextResponse.json({ slug }));
}
