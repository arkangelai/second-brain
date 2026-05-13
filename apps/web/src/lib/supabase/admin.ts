import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@second-brain/shared/env";

import type { Database } from "./types";

type RouteHandlerOnly = {
  routeHandler: true;
};

export function createSupabaseAdminClient(_options: RouteHandlerOnly) {
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
