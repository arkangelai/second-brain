import { serverEnv, publicEnv } from "@second-brain/shared/env";
import { createClient } from "@supabase/supabase-js";

export function createAdminSupabaseClient() {
  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
