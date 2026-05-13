import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requireEnv } from "@/lib/env";

export async function createServerSupabaseClient(responseHeaders?: Headers) {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, headers) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot set cookies. Route Handlers and proxy can.
          }

          Object.entries(headers).forEach(([key, value]) => {
            responseHeaders?.set(key, value);
          });
        },
      },
    }
  );
}

export async function createRouteHandlerSupabaseClient() {
  const responseHeaders = new Headers();
  const supabase = await createServerSupabaseClient(responseHeaders);

  return {
    supabase,
    withSupabaseResponseHeaders<T extends Response>(response: T): T {
      responseHeaders.forEach((value, key) => {
        response.headers.set(key, value);
      });

      return response;
    },
  };
}
