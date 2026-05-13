import "server-only";

import { publicEnv, serverEnv } from "@second-brain/shared/env";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

type RouteHandlerOnly = {
  routeHandler: true;
};

function createAdminClient() {
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createAdminSupabaseClient() {
  return createAdminClient();
}

export function createSupabaseAdminClient(_options: RouteHandlerOnly) {
  return createAdminClient();
}
