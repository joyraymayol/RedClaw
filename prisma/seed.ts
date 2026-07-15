/**
 * Two idempotent jobs, safe to re-run any time:
 *  1. Admin bootstrap: promotes the emails in ADMIN_BOOTSTRAP_EMAILS to
 *     ADMIN/ACTIVE. Each email must have signed in with Google at least
 *     once (the mirror trigger creates the row) — this never inserts users.
 *  2. Starter data (plan §8): enough machines, problem types, and SLA
 *     policies to click through the whole ticket flow. Upserted by their
 *     unique key, so re-running never duplicates rows.
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

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function bootstrapAdmins() {
  if (emails.length === 0) {
    console.warn("ADMIN_BOOTSTRAP_EMAILS is empty — skipping admin bootstrap.");
    return;
  }
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

const MACHINES = [
  { assetCode: "CNC-014", name: "CNC Mill #3", category: "CNC", location: "Bay 3" },
  { assetCode: "INJ-002", name: "Injection Molder #2", category: "Injection", location: "Bay 1" },
  { assetCode: "CONV-007", name: "Main Line Conveyor", category: "Conveyor", location: "Assembly" },
  { assetCode: "CMPR-001", name: "Air Compressor #1", category: "Compressor", location: "Utility Room" },
  { assetCode: "EXT-005", name: "Extruder Line 5", category: "Extrusion", location: "Bay 2" },
] as const;

const PROBLEM_TYPES = [
  { name: "Motor overheating", category: "Electrical" },
  { name: "Belt slippage", category: "Mechanical" },
  { name: "Hydraulic leak", category: "Mechanical" },
  { name: "Sensor fault", category: "Electrical" },
  { name: "Unusual noise/vibration", category: "Mechanical" },
] as const;

// ackMinutes / resolveMinutes per plan §3 example targets.
const SLA_POLICIES = [
  { priority: "CRITICAL", ackMinutes: 15, resolveMinutes: 4 * 60 },
  { priority: "HIGH", ackMinutes: 60, resolveMinutes: 8 * 60 },
  { priority: "MEDIUM", ackMinutes: 4 * 60, resolveMinutes: 2 * 24 * 60 },
  { priority: "LOW", ackMinutes: 8 * 60, resolveMinutes: 5 * 24 * 60 },
] as const;

async function seedStarterData() {
  for (const m of MACHINES) {
    await prisma.machine.upsert({
      where: { assetCode: m.assetCode },
      update: {},
      create: m,
    });
  }
  console.log(`✓ ${MACHINES.length} starter machines ensured`);

  for (const pt of PROBLEM_TYPES) {
    await prisma.problemType.upsert({
      where: { name: pt.name },
      update: {},
      create: pt,
    });
  }
  console.log(`✓ ${PROBLEM_TYPES.length} starter problem types ensured`);

  for (const sla of SLA_POLICIES) {
    await prisma.slaPolicy.upsert({
      where: { priority: sla.priority },
      update: {},
      create: sla,
    });
  }
  console.log(`✓ ${SLA_POLICIES.length} SLA policies ensured`);
}

async function main() {
  await bootstrapAdmins();
  await seedStarterData();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
