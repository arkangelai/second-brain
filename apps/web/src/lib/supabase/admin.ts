import { createClient } from "@supabase/supabase-js";

import { requireEnv } from "@/lib/env";

export function createAdminSupabaseClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
