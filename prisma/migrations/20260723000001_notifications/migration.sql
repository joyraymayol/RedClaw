-- In-app notification inbox. Append-only except "readAt", which flips when the
-- recipient reads it. FKs to the recipient (CASCADE) and the optional actor
-- (SET NULL so a deleted actor doesn't drop the recipient's notification).

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TICKET_ASSIGNED', 'TICKET_UNASSIGNED', 'TICKET_NEEDS_ASSIGNMENT', 'TICKET_RESOLVED', 'TICKET_VERIFY_REQUESTED', 'TICKET_REVIEW_REQUESTED', 'TICKET_CLOSED', 'TICKET_REOPENED', 'TICKET_CANCELLED', 'SETUP_MAINTENANCE_APPROVAL', 'SETUP_QA_APPROVAL', 'SETUP_REJECTED', 'PLAN_APPROVAL_REQUESTED', 'PLAN_APPROVED', 'PLAN_ROW_CHANGED');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "linkPath" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RowLevelSecurity
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
