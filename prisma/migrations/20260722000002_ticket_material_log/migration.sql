-- Free-text materials/spare-parts log, available on every ticket type.
CREATE TABLE "TicketMaterialLog" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "unit" TEXT,
    "loggedById" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMaterialLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TicketMaterialLog_ticketId_idx" ON "TicketMaterialLog"("ticketId");

ALTER TABLE "TicketMaterialLog" ADD CONSTRAINT "TicketMaterialLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketMaterialLog" ADD CONSTRAINT "TicketMaterialLog_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RowLevelSecurity
ALTER TABLE "TicketMaterialLog" ENABLE ROW LEVEL SECURITY;
