import { z } from "zod";

// NEXT_PUBLIC_* vars are statically inlined by Next.js, so they must be
// referenced as literal `process.env.NEXT_PUBLIC_X` expressions — never
// looked up dynamically. Safe to import anywhere.
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url(),
});

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.url(),
  DIRECT_URL: z.url(),
  ADMIN_BOOTSTRAP_EMAILS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    ),
});

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

/** Server-only env. Throws if imported into client bundles or if vars are missing. */
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called on the client");
  }
  cachedServerEnv ??= serverSchema.parse(process.env);
  return cachedServerEnv;
}
