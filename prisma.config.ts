import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// The Prisma CLI doesn't read Next.js env files on its own.
loadEnv({ path: [".env.local", ".env"] });

export default defineConfig({
  experimental: {
    // Required for migrations.initShadowDb (Supabase-managed auth schema).
    externalTables: true,
  },
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
    // The shadow DB used by `migrate dev` is a blank Postgres without
    // Supabase's auth schema — stub just enough of it for the
    // auth_user_mirror migration to apply there.
    initShadowDb: `
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY,
        email text,
        raw_user_meta_data jsonb
      );
    `,
  },
  datasource: {
    // Direct (non-transaction-pooled) connection — required for migrations.
    url: process.env["DIRECT_URL"],
  },
});
