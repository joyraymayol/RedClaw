-- Phase 2: assignTicket's priority-preempt path bumps a busy technician's
-- in-progress ticket to ON_HOLD — that technician needs a notification for
-- it, and none of the existing types fit.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TICKET_ON_HOLD';
