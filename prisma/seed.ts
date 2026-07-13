/**
 * Admin bootstrap: promotes the emails in ADMIN_BOOTSTRAP_EMAILS to
 * ADMIN/ACTIVE. Each email must have signed in with Google at least once
 * (the mirror trigger creates the row) — this script never inserts users.
 *
 * Run with: npm run db:seed
 */
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: [".env.local", ".env"] });

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DIRECT_URL or DATABASE_URL must be set (.env.local)");
  process.exit(1);
}

const emails = (process.env.ADMIN_BOOTSTRAP_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

if (emails.length === 0) {
  console.error("ADMIN_BOOTSTRAP_EMAILS is empty — nothing to do.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  for (const email of emails) {
    const { count } = await prisma.user.updateMany({
      where: { email },
      data: { role: "ADMIN", status: "ACTIVE", isActive: true },
    });
    if (count === 0) {
      console.warn(
        `✗ ${email}: no User row found — sign in with Google once, then re-run.`
      );
    } else {
      console.log(`✓ ${email}: promoted to ADMIN / ACTIVE`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
