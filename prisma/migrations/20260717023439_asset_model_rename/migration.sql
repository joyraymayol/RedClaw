-- Asset Model Overhaul, Phase 1: Machine -> Asset (feature-neutral rename).
-- Hand-written (not `prisma migrate diff`) because a model rename reads as
-- DROP+CREATE to Prisma's diff engine and would lose every existing row.
-- Product/AssetProduct/ProductChangeLog and TicketAsset land in later phases.

-- 1) Enum rename + new status. Safe inside one transaction on PG12+ as long
--    as 'RETIRED' isn't referenced elsewhere in this same migration.
ALTER TYPE "MachineStatus" RENAME TO "AssetStatus";
ALTER TYPE "AssetStatus" ADD VALUE 'RETIRED';

-- 2) New lookup tables: categories (fully CRUD, behavior-by-flag) and types
--    (CRUD lookup scoped to a category).
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tracksProducts" BOOLEAN NOT NULL DEFAULT false,
    "supportsParentAsset" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetCategory_name_key" ON "AssetCategory"("name");

CREATE TABLE "AssetType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "AssetType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetType_categoryId_name_key" ON "AssetType"("categoryId", "name");

ALTER TABLE "AssetType" ADD CONSTRAINT "AssetType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the 4 categories now: the backfill below needs their ids, and
-- prisma/seed.ts upserts these idempotently for fresh databases.
INSERT INTO "AssetCategory" ("id", "name", "tracksProducts", "supportsParentAsset", "updatedAt") VALUES
    (gen_random_uuid()::text, 'Production Machines', true, false, now()),
    (gen_random_uuid()::text, 'Machine Accessories', false, true, now()),
    (gen_random_uuid()::text, 'Facilities', false, false, now()),
    (gen_random_uuid()::text, 'Fleet', false, false, now());

-- 3) Rename the table itself, and its pkey/unique-index, ahead of the new
--    columns and referencing-column renames below.
ALTER TABLE "Machine" RENAME TO "Asset";
ALTER TABLE "Asset" RENAME CONSTRAINT "Machine_pkey" TO "Asset_pkey";
ALTER INDEX "Machine_assetCode_key" RENAME TO "Asset_assetCode_key";

-- 4) New Asset columns. categoryId starts nullable so we can backfill it
--    below; currentProductId is deferred to Phase 3 with the Product table.
ALTER TABLE "Asset"
    ADD COLUMN "categoryId" TEXT,
    ADD COLUMN "typeId" TEXT,
    ADD COLUMN "serialNumber" TEXT,
    ADD COLUMN "manufacturer" TEXT,
    ADD COLUMN "model" TEXT,
    ADD COLUMN "installedAt" TIMESTAMP(3),
    ADD COLUMN "commissionedAt" TIMESTAMP(3),
    ADD COLUMN "warrantyExpiresAt" TIMESTAMP(3),
    ADD COLUMN "retiredAt" TIMESTAMP(3),
    ADD COLUMN "parentAssetId" TEXT;

-- 5) Backfill: the one existing accessory-like row (compressor) becomes
--    Machine Accessories, everything else Production Machines.
UPDATE "Asset" a SET "categoryId" = c.id
FROM "AssetCategory" c
WHERE c.name = CASE WHEN a.category ILIKE '%compressor%' THEN 'Machine Accessories' ELSE 'Production Machines' END;

ALTER TABLE "Asset" ALTER COLUMN "categoryId" SET NOT NULL;

-- Preserve the old free-text category as an AssetType under the mapped
-- category, then point each asset at it.
INSERT INTO "AssetType" ("id", "name", "categoryId")
SELECT gen_random_uuid()::text, x.category, x."categoryId"
FROM (SELECT DISTINCT ON (category) category, "categoryId" FROM "Asset" WHERE category IS NOT NULL) x;

UPDATE "Asset" a SET "typeId" = t.id
FROM "AssetType" t
WHERE t.name = a.category;

ALTER TABLE "Asset" DROP COLUMN "category";

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AssetType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_parentAssetId_fkey" FOREIGN KEY ("parentAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Asset_categoryId_idx" ON "Asset"("categoryId");
CREATE INDEX "Asset_status_idx" ON "Asset"("status");
CREATE INDEX "Asset_parentAssetId_idx" ON "Asset"("parentAssetId");

-- 6) Rename every machineId column (and its constraints/indexes) that
--    points at the renamed table. Renaming, not drop+recreate, keeps the
--    same FK enforcing the whole time (Postgres tracks FKs by OID, not name).
ALTER TABLE "Ticket" RENAME COLUMN "machineId" TO "assetId";
ALTER TABLE "Ticket" RENAME CONSTRAINT "Ticket_machineId_fkey" TO "Ticket_assetId_fkey";
ALTER INDEX "Ticket_machineId_idx" RENAME TO "Ticket_assetId_idx";

ALTER TABLE "Solution" RENAME COLUMN "machineId" TO "assetId";
ALTER TABLE "Solution" RENAME CONSTRAINT "Solution_machineId_fkey" TO "Solution_assetId_fkey";

ALTER TABLE "MaintenanceSchedule" RENAME COLUMN "machineId" TO "assetId";
ALTER TABLE "MaintenanceSchedule" RENAME CONSTRAINT "MaintenanceSchedule_machineId_fkey" TO "MaintenanceSchedule_assetId_fkey";

ALTER TABLE "DowntimeLog" RENAME COLUMN "machineId" TO "assetId";
ALTER TABLE "DowntimeLog" RENAME CONSTRAINT "DowntimeLog_machineId_fkey" TO "DowntimeLog_assetId_fkey";
ALTER INDEX "DowntimeLog_machineId_idx" RENAME TO "DowntimeLog_assetId_idx";

ALTER TABLE "MachineUsageLog" RENAME TO "AssetUsageLog";
ALTER TABLE "AssetUsageLog" RENAME COLUMN "machineId" TO "assetId";
ALTER TABLE "AssetUsageLog" RENAME CONSTRAINT "MachineUsageLog_pkey" TO "AssetUsageLog_pkey";
ALTER TABLE "AssetUsageLog" RENAME CONSTRAINT "MachineUsageLog_machineId_fkey" TO "AssetUsageLog_assetId_fkey";
ALTER TABLE "AssetUsageLog" RENAME CONSTRAINT "MachineUsageLog_recordedById_fkey" TO "AssetUsageLog_recordedById_fkey";
ALTER INDEX "MachineUsageLog_machineId_recordedAt_idx" RENAME TO "AssetUsageLog_assetId_recordedAt_idx";

-- 7) RLS on the new tables (house convention: no policies, Prisma bypasses as owner).
ALTER TABLE "AssetCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssetType" ENABLE ROW LEVEL SECURITY;
