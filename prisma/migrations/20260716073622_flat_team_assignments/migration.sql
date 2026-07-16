-- Flat team of equals: TicketAssignment open rows (unassignedAt IS NULL)
-- become the sole source of truth for a ticket's current technicians,
-- replacing the single Ticket.assignedTechnicianId scalar.

-- 1) Normalize: close any open assignment row that doesn't mirror the
--    scalar it's about to be decoupled from (defends against the latent
--    bug where assignTicket on a REOPENED ticket left a stale open row).
UPDATE "TicketAssignment" a SET "unassignedAt" = now()
FROM "Ticket" t
WHERE t.id = a."ticketId" AND a."unassignedAt" IS NULL
  AND (t."assignedTechnicianId" IS NULL OR a."technicianId" <> t."assignedTechnicianId");

-- 2) Dedupe: keep only the newest open row per (ticket, technician), in
--    case two open rows for the same member ever coexisted.
UPDATE "TicketAssignment" a SET "unassignedAt" = now()
WHERE a."unassignedAt" IS NULL AND EXISTS (
  SELECT 1 FROM "TicketAssignment" b
  WHERE b."ticketId" = a."ticketId" AND b."technicianId" = a."technicianId"
    AND b."unassignedAt" IS NULL AND (b."assignedAt", b.id) > (a."assignedAt", a.id)
);

-- 3) Guard: every scalar-assigned ticket must now have exactly one
--    matching open row, or this migration aborts rather than silently
--    losing an assignment.
DO $$ DECLARE bad int; BEGIN
  SELECT count(*) INTO bad FROM "Ticket" t
  WHERE t."assignedTechnicianId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "TicketAssignment" a
    WHERE a."ticketId" = t.id AND a."unassignedAt" IS NULL
      AND a."technicianId" = t."assignedTechnicianId"
  );
  IF bad > 0 THEN RAISE EXCEPTION 'assignment mirror drift on % ticket(s) — aborting', bad; END IF;
END $$;

-- 4) The scalar-keyed busy-rule index cannot survive flat teams — the
--    busy check is now app-level only (see startWork/resumeTicket guards).
DROP INDEX "one_active_ticket_per_tech";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_assignedTechnicianId_fkey";

-- DropIndex
DROP INDEX "Ticket_assignedTechnicianId_idx";

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "assignedTechnicianId";

-- Backstop: at most one OPEN membership per technician per ticket.
CREATE UNIQUE INDEX "one_open_assignment_per_member"
ON "TicketAssignment" ("ticketId", "technicianId")
WHERE "unassignedAt" IS NULL;
