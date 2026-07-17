-- Multi-asset tickets: a ticket is created against exactly one asset, then
-- ADMIN/HEAD or an assigned technician can re-flag it to one or more.
-- Replaces the scalar Ticket.assetId with the TicketAsset join, mirroring
-- the flat_team_assignments migration's flat-membership pattern.

-- CreateTable
CREATE TABLE "TicketAsset" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "flaggedById" TEXT NOT NULL,
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unflaggedAt" TIMESTAMP(3),

    CONSTRAINT "TicketAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketAsset_ticketId_idx" ON "TicketAsset"("ticketId");

-- CreateIndex
CREATE INDEX "TicketAsset_assetId_idx" ON "TicketAsset"("assetId");

-- AddForeignKey
ALTER TABLE "TicketAsset" ADD CONSTRAINT "TicketAsset_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAsset" ADD CONSTRAINT "TicketAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAsset" ADD CONSTRAINT "TicketAsset_flaggedById_fkey" FOREIGN KEY ("flaggedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 1) Backfill: one open flag per existing ticket, from the scalar
--    Ticket.assetId (flaggedById = the ticket's requester, flaggedAt = its
--    createdAt — the closest honest approximation of "who/when flagged it").
INSERT INTO "TicketAsset" ("id", "ticketId", "assetId", "flaggedById", "flaggedAt")
SELECT gen_random_uuid(), "id", "assetId", "requesterId", "createdAt"
FROM "Ticket";

-- 2) Guard: every ticket must now have exactly one open flag, or this
--    migration aborts rather than silently losing an asset association.
DO $$ DECLARE bad int; BEGIN
  SELECT count(*) INTO bad FROM "Ticket" t
  WHERE NOT EXISTS (
    SELECT 1 FROM "TicketAsset" a
    WHERE a."ticketId" = t.id AND a."unflaggedAt" IS NULL
  );
  IF bad > 0 THEN RAISE EXCEPTION 'asset flag backfill drift on % ticket(s) — aborting', bad; END IF;
END $$;

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_assetId_fkey";

-- DropIndex
DROP INDEX "Ticket_assetId_idx";

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "assetId";

-- Backstop: at most one OPEN flag per asset per ticket.
CREATE UNIQUE INDEX "one_open_flag_per_asset"
ON "TicketAsset" ("ticketId", "assetId")
WHERE "unflaggedAt" IS NULL;

-- RowLevelSecurity
ALTER TABLE "TicketAsset" ENABLE ROW LEVEL SECURITY;
