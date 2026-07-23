-- Production Plan module: form-numbered weekly plans with one row per
-- Production Machine, a designated-approver set, and a per-row change log.

-- CreateEnum
CREATE TYPE "ProductionPlanStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED');

-- CreateTable
CREATE TABLE "ProductionPlan" (
    "id" TEXT NOT NULL,
    "formNumber" TEXT NOT NULL,
    "scheduleFrom" TIMESTAMP(3) NOT NULL,
    "scheduleTo" TIMESTAMP(3) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" "ProductionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "preparedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionPlanRow" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "statusInstruction" TEXT NOT NULL,
    "productId" TEXT,
    "referenceCycleTime" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "approvedSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionPlanRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionPlanRowChange" (
    "id" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,

    CONSTRAINT "ProductionPlanRowChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionPlanApprover" (
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionPlanApprover_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "ProductionPlan_status_idx" ON "ProductionPlan"("status");
CREATE INDEX "ProductionPlan_preparedById_idx" ON "ProductionPlan"("preparedById");
CREATE INDEX "ProductionPlanRow_planId_idx" ON "ProductionPlanRow"("planId");
CREATE INDEX "ProductionPlanRow_assetId_idx" ON "ProductionPlanRow"("assetId");
CREATE INDEX "ProductionPlanRowChange_rowId_idx" ON "ProductionPlanRowChange"("rowId");

-- AddForeignKey
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionPlanRow" ADD CONSTRAINT "ProductionPlanRow_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProductionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionPlanRow" ADD CONSTRAINT "ProductionPlanRow_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionPlanRow" ADD CONSTRAINT "ProductionPlanRow_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionPlanRowChange" ADD CONSTRAINT "ProductionPlanRowChange_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "ProductionPlanRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionPlanRowChange" ADD CONSTRAINT "ProductionPlanRowChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionPlanApprover" ADD CONSTRAINT "ProductionPlanApprover_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RowLevelSecurity
ALTER TABLE "ProductionPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductionPlanRow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductionPlanRowChange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductionPlanApprover" ENABLE ROW LEVEL SECURITY;
