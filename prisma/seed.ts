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

// Department-spanning QA accounts. Like bootstrapAdmins, this *promotes*
// existing rows by email — it never inserts, so no orphan without an auth
// user. Create the auth accounts first (Supabase admin API → mirror trigger),
// then re-run the seed to fast-track them past onboarding into the right role
// + department. Every gate the new ticket types introduce is exercisable
// through this set: PM/Machine-Setup creation (Maintenance leads), the QA
// approval stage, plan preparation (Production), and plan approval.
const TEST_USERS = [
  { email: "maint.head.test@example.com", role: "HEAD", department: "MAINTENANCE", position: "Maintenance Head" },
  { email: "maint.sup.test@example.com", role: "SUPERVISOR", department: "MAINTENANCE", position: "Maintenance Supervisor" },
  { email: "qa.sup.test@example.com", role: "SUPERVISOR", department: "QUALITY_ASSURANCE", position: "QA Supervisor" },
  { email: "prod.staff.test@example.com", role: "REQUESTER", department: "PRODUCTION", position: "Production Planner" },
  { email: "prod.head.test@example.com", role: "HEAD", department: "PRODUCTION", position: "Production Head" },
] as const;

// Reusable PM checklist templates, attached as the default template on the
// listed Production Machines. Items are snapshotted onto a PM ticket at
// creation, so editing a template never rewrites a historical ticket.
const PM_TEMPLATES = [
  {
    name: "PET Blow Molder — Weekly PM",
    description: "Weekly preventive checklist for PET stretch-blow machines.",
    items: [
      "Check and top up hydraulic oil level",
      "Inspect heating lamps and reflectors",
      "Verify mold clamp pressure",
      "Clean air filters and check compressor pressure",
      "Inspect preform feed rail for wear",
    ],
    assetCodes: ["CNC-014", "CONV-007"],
  },
  {
    name: "Injection Molder — Monthly PM",
    description: "Monthly preventive checklist for injection molding machines.",
    items: [
      "Grease toggle links and tie bars",
      "Check barrel heater bands and thermocouples",
      "Inspect and clean cooling water lines",
      "Verify safety gate interlocks",
      "Check ejector plate alignment",
    ],
    assetCodes: ["INJ-002", "EXT-005"],
  },
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

async function promoteTestUsers() {
  let promoted = 0;
  for (const u of TEST_USERS) {
    const { count } = await prisma.user.updateMany({
      where: { email: u.email },
      data: {
        role: u.role,
        department: u.department,
        position: u.position,
        status: "ACTIVE",
        isActive: true,
      },
    });
    if (count > 0) promoted += 1;
    else console.warn(`  · ${u.email}: no User row yet — create the auth account, then re-run.`);
  }
  console.log(`✓ ${promoted}/${TEST_USERS.length} department test users promoted`);
}

// Give every Production Machine the ability to run each catalog product, so
// plan rows and Machine-Setup tickets have real capabilities to target.
async function seedAssetProductCapabilities() {
  const machines = await prisma.asset.findMany({
    where: { category: { tracksProducts: true } },
    select: { id: true },
  });
  const products = await prisma.product.findMany({ select: { id: true } });
  let count = 0;
  for (const m of machines) {
    for (const p of products) {
      await prisma.assetProduct.upsert({
        where: { assetId_productId: { assetId: m.id, productId: p.id } },
        update: {},
        create: { assetId: m.id, productId: p.id },
      });
      count += 1;
    }
  }
  console.log(`✓ ${count} asset-product capabilities ensured`);
}

async function seedPmChecklistTemplates() {
  for (const tpl of PM_TEMPLATES) {
    const template = await prisma.pmChecklistTemplate.upsert({
      where: { name: tpl.name },
      update: { description: tpl.description },
      create: { name: tpl.name, description: tpl.description },
    });
    // Only seed items into an empty template — don't churn ids on re-run.
    const itemCount = await prisma.pmChecklistTemplateItem.count({
      where: { templateId: template.id },
    });
    if (itemCount === 0) {
      await prisma.pmChecklistTemplateItem.createMany({
        data: tpl.items.map((label, i) => ({ templateId: template.id, label, sortOrder: i })),
      });
    }
    await prisma.asset.updateMany({
      where: { assetCode: { in: [...tpl.assetCodes] } },
      data: { pmChecklistTemplateId: template.id },
    });
  }
  console.log(`✓ ${PM_TEMPLATES.length} PM checklist templates ensured`);
}

// One DRAFT + one APPROVED plan so both sides of the flow (submit/approve and
// the frozen "initial request" + change log) are demoable, plus a designated
// approver. Keyed by formNumber for idempotency (formNumber isn't unique in
// the schema, so a findFirst guard stands in for upsert).
async function seedProductionPlans() {
  const preparer =
    (await prisma.user.findFirst({
      where: { email: "prod.staff.test@example.com", status: "ACTIVE" },
    })) ??
    (await prisma.user.findFirst({
      where: { status: "ACTIVE", OR: [{ department: "PRODUCTION" }, { role: "ADMIN" }] },
    }));
  if (!preparer) {
    console.warn(
      "  · Production plans skipped — no ACTIVE Production/ADMIN user to prepare them."
    );
    return;
  }

  const approver =
    (await prisma.user.findFirst({
      where: { email: "prod.head.test@example.com", status: "ACTIVE" },
    })) ??
    (await prisma.user.findFirst({
      where: { status: "ACTIVE", role: { in: ["ADMIN", "HEAD"] } },
    })) ??
    preparer;

  await prisma.productionPlanApprover.upsert({
    where: { userId: approver.id },
    update: {},
    create: { userId: approver.id },
  });

  const machines = await prisma.asset.findMany({
    where: { status: { not: "RETIRED" }, category: { tracksProducts: true } },
    select: { id: true, productCapabilities: { select: { productId: true } } },
    orderBy: { assetCode: "asc" },
  });
  if (machines.length === 0) {
    console.warn("  · Production plans skipped — no Production Machines found.");
    return;
  }

  const buildRows = () =>
    machines.map((m, i) => ({
      assetId: m.id,
      statusInstruction: i === 0 ? "Run" : "Standby",
      productId: m.productCapabilities[0]?.productId ?? null,
      referenceCycleTime: "12 s/cycle",
      remarks: "",
      sortOrder: i,
    }));

  const draftExists = await prisma.productionPlan.findFirst({
    where: { formNumber: "PP-2026-001" },
    select: { id: true },
  });
  if (!draftExists) {
    await prisma.productionPlan.create({
      data: {
        formNumber: "PP-2026-001",
        scheduleFrom: new Date("2026-07-27"),
        scheduleTo: new Date("2026-08-02"),
        effectiveDate: new Date("2026-07-27"),
        status: "DRAFT",
        preparedById: preparer.id,
        rows: { create: buildRows() },
      },
    });
    console.log("✓ Draft production plan PP-2026-001 created");
  }

  const approvedExists = await prisma.productionPlan.findFirst({
    where: { formNumber: "PP-2026-002" },
    select: { id: true },
  });
  if (!approvedExists) {
    const rows = buildRows();
    const productIds = [
      ...new Set(rows.map((r) => r.productId).filter((id): id is string => !!id)),
    ];
    const products = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = (id: string | null) =>
      id ? (products.find((p) => p.id === id)?.name ?? null) : null;
    const now = new Date();
    await prisma.productionPlan.create({
      data: {
        formNumber: "PP-2026-002",
        scheduleFrom: new Date("2026-07-20"),
        scheduleTo: new Date("2026-07-26"),
        effectiveDate: new Date("2026-07-20"),
        status: "APPROVED",
        preparedById: preparer.id,
        approvedById: approver.id,
        approvedAt: now,
        frozenAt: now,
        rows: {
          create: rows.map((r) => ({
            ...r,
            approvedSnapshot: {
              statusInstruction: r.statusInstruction,
              productId: r.productId,
              productName: nameOf(r.productId),
              referenceCycleTime: r.referenceCycleTime,
              remarks: r.remarks,
            },
          })),
        },
      },
    });
    console.log("✓ Approved production plan PP-2026-002 created");
  }
}

async function main() {
  await bootstrapAdmins();
  await seedStarterData();
  await promoteTestUsers();
  await seedAssetProductCapabilities();
  await seedPmChecklistTemplates();
  await seedProductionPlans();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
