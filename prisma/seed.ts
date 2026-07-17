/**
 * Two idempotent jobs, safe to re-run any time:
 *  1. Admin bootstrap: promotes the emails in ADMIN_BOOTSTRAP_EMAILS to
 *     ADMIN/ACTIVE. Each email must have signed in with Google at least
 *     once (the mirror trigger creates the row) — this never inserts users.
 *  2. Starter data (plan §8): enough asset categories/types/assets, problem
 *     types, and SLA policies to click through the whole ticket flow.
 *     Upserted by their unique key, so re-running never duplicates rows.
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

const ASSET_CATEGORIES = [
  { name: "Production Machines", tracksProducts: true, supportsParentAsset: false },
  { name: "Machine Accessories", tracksProducts: false, supportsParentAsset: true },
  { name: "Facilities", tracksProducts: false, supportsParentAsset: false },
  { name: "Fleet", tracksProducts: false, supportsParentAsset: false },
] as const;

// A realistic type catalog per category — available as dropdown options
// once assets exist, independent of the ad-hoc types the 5 demo assets
// below already carry from Phase 1's free-text backfill (CNC, Injection,
// Conveyor, Compressor, Extrusion).
const ASSET_TYPES = [
  { category: "Production Machines", name: "PET Stretch Blow" },
  { category: "Production Machines", name: "Blow Molding" },
  { category: "Production Machines", name: "Injection Molding" },
  { category: "Machine Accessories", name: "Chiller" },
  { category: "Machine Accessories", name: "Air Compressor" },
  { category: "Machine Accessories", name: "Mold Temp Controller" },
  { category: "Facilities", name: "Lighting" },
  { category: "Facilities", name: "Airconditioning" },
  { category: "Facilities", name: "Electrical" },
  { category: "Facilities", name: "Building" },
  { category: "Fleet", name: "Delivery Truck" },
  { category: "Fleet", name: "Forklift" },
  { category: "Fleet", name: "Heavy Equipment" },
] as const;

const PRODUCTS = ["PET Small Bottle", "PET 2L Bottle"] as const;

const ASSETS = [
  { assetCode: "CNC-014", name: "CNC Mill #3", category: "Production Machines", type: "CNC", location: "Bay 3" },
  { assetCode: "INJ-002", name: "Injection Molder #2", category: "Production Machines", type: "Injection", location: "Bay 1" },
  { assetCode: "CONV-007", name: "Main Line Conveyor", category: "Production Machines", type: "Conveyor", location: "Assembly" },
  { assetCode: "CMPR-001", name: "Air Compressor #1", category: "Machine Accessories", type: "Compressor", location: "Utility Room" },
  { assetCode: "EXT-005", name: "Extruder Line 5", category: "Production Machines", type: "Extrusion", location: "Bay 2" },
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
  const categoryIds = new Map<string, string>();
  for (const c of ASSET_CATEGORIES) {
    const category = await prisma.assetCategory.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
    categoryIds.set(c.name, category.id);
  }
  console.log(`✓ ${ASSET_CATEGORIES.length} asset categories ensured`);

  const typeIds = new Map<string, string>();
  for (const a of ASSETS) {
    if (typeIds.has(a.type)) continue;
    const categoryId = categoryIds.get(a.category)!;
    const type = await prisma.assetType.upsert({
      where: { categoryId_name: { categoryId, name: a.type } },
      update: {},
      create: { name: a.type, categoryId },
    });
    typeIds.set(a.type, type.id);
  }
  for (const t of ASSET_TYPES) {
    if (typeIds.has(t.name)) continue;
    const categoryId = categoryIds.get(t.category)!;
    await prisma.assetType.upsert({
      where: { categoryId_name: { categoryId, name: t.name } },
      update: {},
      create: { name: t.name, categoryId },
    });
  }
  console.log(`✓ ${ASSET_TYPES.length} asset types ensured`);

  for (const name of PRODUCTS) {
    await prisma.product.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`✓ ${PRODUCTS.length} products ensured`);

  for (const a of ASSETS) {
    await prisma.asset.upsert({
      where: { assetCode: a.assetCode },
      update: {},
      create: {
        assetCode: a.assetCode,
        name: a.name,
        location: a.location,
        categoryId: categoryIds.get(a.category)!,
        typeId: typeIds.get(a.type)!,
      },
    });
  }
  console.log(`✓ ${ASSETS.length} starter assets ensured`);

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
