import "server-only";

import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@second-brain/shared/env";
import { cookies } from "next/headers";

import type { Database } from "./types";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components can read but not mutate cookies. Route Handlers
            // and Server Actions still set refreshed Supabase cookies here.
          }
        },
      },
    }
  );
}
