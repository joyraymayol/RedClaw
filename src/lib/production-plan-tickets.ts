import type { TicketStatus } from "@/generated/prisma/enums";

/**
 * A machine-setup ticket stays "current" for a plan row — including once
 * Closed — until the row is edited again after it was raised (plan §6
 * mid-week change), which makes the row's live instructions diverge from
 * what the ticket was created for. The one exception is Cancelled: that
 * means the setup never actually happened, so there's nothing for a new
 * ticket to supersede and it's allowed right away. Shared by the create
 * action's server-side gate and the plan page's UI affordance so the two
 * can't drift apart.
 */
export function canCreateNewSetupTicket(
  latestTicket: { status: TicketStatus; createdAt: Date } | null,
  latestChangeAt: Date | null
): boolean {
  if (!latestTicket) return true;
  if (latestTicket.status === "CANCELLED") return true;
  return !!latestChangeAt && latestChangeAt > latestTicket.createdAt;
}
