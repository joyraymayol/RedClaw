import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env";

/** Browser Supabase client — for client components (OAuth redirects, etc.). */
export function createClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
