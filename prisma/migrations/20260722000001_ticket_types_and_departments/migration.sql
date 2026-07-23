-- Department becomes a real enum (was free-text `String?`). Map the known
-- placeholder labels the onboarding form wrote; anything else -> NULL.
CREATE TYPE "Department" AS ENUM (
  'PRODUCTION',
  'MAINTENANCE',
  'QUALITY_ASSURANCE',
  'WAREHOUSE',
  'ADMINISTRATION'
);

ALTER TABLE "User"
  ALTER COLUMN "department" TYPE "Department"
  USING (
    CASE "department"
      WHEN 'Production' THEN 'PRODUCTION'
      WHEN 'Maintenance' THEN 'MAINTENANCE'
      WHEN 'Quality Assurance' THEN 'QUALITY_ASSURANCE'
      WHEN 'Warehouse' THEN 'WAREHOUSE'
      WHEN 'Administration' THEN 'ADMINISTRATION'
      ELSE NULL
    END
  )::"Department";

-- New Machine-Setup dual-approval statuses (positioned to match schema order).
ALTER TYPE "TicketStatus" ADD VALUE 'PENDING_MAINTENANCE_APPROVAL' AFTER 'PENDING_SUPERVISOR_REVIEW';
ALTER TYPE "TicketStatus" ADD VALUE 'PENDING_QA_APPROVAL' AFTER 'PENDING_MAINTENANCE_APPROVAL';

-- Ticket type. Existing rows are all unplanned repairs -> MAINTENANCE (default).
CREATE TYPE "TicketType" AS ENUM (
  'MAINTENANCE',
  'PREVENTIVE_MAINTENANCE',
  'MACHINE_SETUP'
);

ALTER TABLE "Ticket" ADD COLUMN "type" "TicketType" NOT NULL DEFAULT 'MAINTENANCE';

CREATE INDEX "Ticket_type_idx" ON "Ticket"("type");
