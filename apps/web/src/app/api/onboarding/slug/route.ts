import { NextResponse, type NextRequest } from "next/server";

import { findAvailableTeamSlug } from "@/lib/onboarding/slug";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const value = request.nextUrl.searchParams.get("value") ?? "";
  const admin = createAdminSupabaseClient();
  const slug = await findAvailableTeamSlug(admin, value);

  return NextResponse.json({ slug });
}
