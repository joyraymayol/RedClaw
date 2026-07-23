-- Reusable PM checklist templates + their items, and a per-ticket snapshot.
CREATE TABLE "PmChecklistTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmChecklistTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketChecklistResult" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "remark" TEXT,
    "checkedById" TEXT,
    "checkedAt" TIMESTAMP(3),

    CONSTRAINT "TicketChecklistResult_pkey" PRIMARY KEY ("id")
);

-- Asset gains a default template pointer.
ALTER TABLE "Asset" ADD COLUMN "pmChecklistTemplateId" TEXT;

CREATE UNIQUE INDEX "PmChecklistTemplate_name_key" ON "PmChecklistTemplate"("name");
CREATE INDEX "PmChecklistTemplateItem_templateId_idx" ON "PmChecklistTemplateItem"("templateId");
CREATE INDEX "TicketChecklistResult_ticketId_idx" ON "TicketChecklistResult"("ticketId");
CREATE INDEX "Asset_pmChecklistTemplateId_idx" ON "Asset"("pmChecklistTemplateId");

ALTER TABLE "PmChecklistTemplateItem" ADD CONSTRAINT "PmChecklistTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PmChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketChecklistResult" ADD CONSTRAINT "TicketChecklistResult_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketChecklistResult" ADD CONSTRAINT "TicketChecklistResult_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_pmChecklistTemplateId_fkey" FOREIGN KEY ("pmChecklistTemplateId") REFERENCES "PmChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RowLevelSecurity
ALTER TABLE "PmChecklistTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PmChecklistTemplateItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TicketChecklistResult" ENABLE ROW LEVEL SECURITY;
