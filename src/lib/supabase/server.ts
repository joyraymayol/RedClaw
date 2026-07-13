import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env";

/** Server Supabase client — for Server Components, Server Actions, Route Handlers. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore as long as the proxy refreshes sessions.
          }
        },
      },
    }
  );
}
