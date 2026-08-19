-- Asset <-> PmChecklistTemplate becomes many-to-many (was Asset.pmChecklistTemplateId,
-- a single default checklist per asset). Ticket gains a display-only pointer
-- to which checklist the requester picked at creation time.

-- CreateTable
CREATE TABLE "AssetPmChecklistTemplate" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetPmChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetPmChecklistTemplate_assetId_idx" ON "AssetPmChecklistTemplate"("assetId");

-- CreateIndex
CREATE INDEX "AssetPmChecklistTemplate_templateId_idx" ON "AssetPmChecklistTemplate"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetPmChecklistTemplate_assetId_templateId_key" ON "AssetPmChecklistTemplate"("assetId", "templateId");

-- AddForeignKey
ALTER TABLE "AssetPmChecklistTemplate" ADD CONSTRAINT "AssetPmChecklistTemplate_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPmChecklistTemplate" ADD CONSTRAINT "AssetPmChecklistTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PmChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry over any existing single-template assignments before dropping the column.
INSERT INTO "AssetPmChecklistTemplate" ("id", "assetId", "templateId", "addedAt")
SELECT gen_random_uuid()::text, "id", "pmChecklistTemplateId", CURRENT_TIMESTAMP
FROM "Asset"
WHERE "pmChecklistTemplateId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_pmChecklistTemplateId_fkey";

-- DropIndex
DROP INDEX "Asset_pmChecklistTemplateId_idx";

-- AlterTable
ALTER TABLE "Asset" DROP COLUMN "pmChecklistTemplateId";

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "pmChecklistTemplateId" TEXT;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_pmChecklistTemplateId_fkey" FOREIGN KEY ("pmChecklistTemplateId") REFERENCES "PmChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RowLevelSecurity
ALTER TABLE "AssetPmChecklistTemplate" ENABLE ROW LEVEL SECURITY;
