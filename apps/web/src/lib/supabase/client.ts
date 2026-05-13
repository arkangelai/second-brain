"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@second-brain/shared/env";

import type { Database } from "./types";

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
