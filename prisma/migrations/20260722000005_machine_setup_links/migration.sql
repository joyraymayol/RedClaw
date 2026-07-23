-- Link Machine-Setup tickets to the Production Plan row that spawned them
-- (provenance) and to the target mold/product applied to the machine on QA
-- close.
ALTER TABLE "Ticket" ADD COLUMN "productionPlanRowId" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "targetProductId" TEXT;

CREATE INDEX "Ticket_productionPlanRowId_idx" ON "Ticket"("productionPlanRowId");

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_productionPlanRowId_fkey" FOREIGN KEY ("productionPlanRowId") REFERENCES "ProductionPlanRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
